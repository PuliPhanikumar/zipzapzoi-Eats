/**
 * ════════════════════════════════════════════════════
 * ZipZapZoi Eats — Production Backend API Server
 * ════════════════════════════════════════════════════
 * Features: JWT Auth, RBAC, Razorpay, Escrow Wallets,
 * WebSockets, Push Notifications, File Uploads,
 * Google OAuth, Full CRUD for all entities.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const webpush = require('web-push');
const { OAuth2Client } = require('google-auth-library');
const notifications = require('./notifications');
const uploadService = require('./uploadService');
const { verifyToken, optionalToken, requireRole, getSecret } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const validate = require('./middleware/validate');

// ─── INIT ───────────────────────────────────────────────
const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

const corsOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
// In production, also allow both domains (Eats on .in, parent portal on .com)
if (process.env.NODE_ENV === 'production') {
    corsOrigins.push(
        'https://zipzapzoi.in', 'https://www.zipzapzoi.in',
        'https://zipzapzoi.com', 'https://www.zipzapzoi.com'
    );
}
const io = new Server(server, { cors: { origin: corsOrigins } });

const googleClient = process.env.GOOGLE_CLIENT_ID
    ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    : null;

// ─── MIDDLEWARE ──────────────────────────────────────────
// Trust proxy is required for Render so express-rate-limit tracks the actual user IP, not the load balancer
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false })); // CSP off for static HTML pages
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files (HTML, JS, CSS, images)
app.use(express.static(path.join(__dirname, '..'), {
    extensions: ['html'],
    index: 'index.html',
    maxAge: 0, // Disabled aggressive caching so updates deploy instantly
    etag: true
}));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { error: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many auth attempts, please try again later.' }
});
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ─── WEBSOCKETS ─────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('📡 Client connected:', socket.id);

    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('chat_message', (msg) => {
        io.emit('chat_message', { ...msg, timestamp: new Date() });
    });

    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ─── RAZORPAY INIT ──────────────────────────────────────
let razorpay = null;
try {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const Razorpay = require('razorpay');
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }
} catch (e) {
    console.warn('⚠️ Razorpay not initialized:', e.message);
}

// ─── VAPID SETUP ────────────────────────────────────────
if (process.env.PUBLIC_VAPID_KEY && process.env.PRIVATE_VAPID_KEY) {
    webpush.setVapidDetails(
        'mailto:eats@zipzapzoi.in',
        process.env.PUBLIC_VAPID_KEY,
        process.env.PRIVATE_VAPID_KEY
    );
}

// ════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'ZipZapZoi Eats Backend is running!',
        version: '2.0.0',
        time: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// ════════════════════════════════════════════════════════
// SERVICE CONFIGURATION ENDPOINTS
// ════════════════════════════════════════════════════════
app.get('/api/config/upload-provider', (req, res) => {
    res.json(uploadService.getProvider());
});

app.get('/api/push/vapid-key', (req, res) => {
    const key = process.env.PUBLIC_VAPID_KEY;
    if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
    res.json({ publicKey: key });
});

app.get('/api/config/services', (req, res) => {
    res.json({
        upload: uploadService.getProvider(),
        notifications: notifications.getStatus(),
        push: !!process.env.PUBLIC_VAPID_KEY,
        oauth: { google: !!process.env.GOOGLE_CLIENT_ID }
    });
});

// ════════════════════════════════════════════════════════
// AUTHENTICATION APIs
// ════════════════════════════════════════════════════════
app.post('/api/auth/register', validate.validateRegister, async (req, res, next) => {
    try {
        const { name, email, phone, password, role } = req.body;

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email or phone' });
        }

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        const rolePrefix = role === 'partner' ? 'PART-' : role === 'rider' ? 'RIDE-' : 'CUST-';
        const zoiId = rolePrefix + Math.floor(100000 + Math.random() * 900000);

        const newUser = await prisma.user.create({
            data: { zoiId, name, email, phone, role: role || 'Customer', passwordHash }
        });

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role, zoiId: newUser.zoiId, name: newUser.name },
            getSecret(), { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: { id: newUser.id, name: newUser.name, role: newUser.role, zoiId: newUser.zoiId, email: newUser.email }
        });
    } catch (error) { next(error); }
});

app.post('/api/auth/login', validate.validateLogin, async (req, res, next) => {
    try {
        const { identifier, password } = req.body;

        const user = await prisma.user.findFirst({
            where: { OR: [{ email: identifier }, { zoiId: identifier }, { phone: identifier }] }
        });

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        if (user.status === 'Suspended' || user.status === 'Banned') {
            return res.status(403).json({ error: `Account ${user.status}. Please contact support.` });
        }

        if (user.passwordHash) {
            const isValid = await bcrypt.compare(password, user.passwordHash);
            if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, zoiId: user.zoiId, name: user.name },
            getSecret(), { expiresIn: '24h' }
        );

        // Resolve Restaurant Context for Partners/Staff
        let restaurantId = null;
        const roleLower = (user.role || '').toLowerCase();
        if (roleLower === 'partner') {
            const rest = await prisma.restaurant.findFirst({ 
                where: { OR: [{ ownerEmail: user.email }, { phone: user.phone }] } 
            });
            if (rest) restaurantId = rest.id;
        } else if (roleLower === 'pos_staff') {
            const staff = await prisma.restaurantStaff.findFirst({ 
                where: { OR: [{ email: user.email }, { phone: user.phone }] } 
            });
            if (staff) restaurantId = staff.restaurantId;
        }

        res.json({
            message: 'Login successful', token,
            user: { 
                id: user.id, name: user.name, role: user.role, zoiId: user.zoiId, 
                email: user.email, phone: user.phone, restaurantId 
            }
        });
    } catch (error) { next(error); }
});

app.post('/api/auth/otp/send', validate.validateOtpSend, async (req, res, next) => {
    try {
        const { phone } = req.body;
        const isDemoMode = process.env.DEMO_MODE === 'true';

        if (isDemoMode) {
            console.log(`[Demo Mode] OTP 1234 sent to ${phone}`);
        } else {
            // TODO: Integrate Twilio/MSG91 for production OTP
            console.log(`[Production] OTP would be sent to ${phone}`);
        }
        res.json({ message: 'OTP sent successfully' });
    } catch (error) { next(error); }
});

app.post('/api/auth/otp/verify', validate.validateOtpVerify, async (req, res, next) => {
    try {
        const { phone, otp, role } = req.body;
        const isDemoMode = process.env.DEMO_MODE === 'true';

        if (isDemoMode) {
            if (otp !== '1234') return res.status(401).json({ error: 'Invalid OTP' });
        } else {
            // TODO: Verify OTP against Twilio/MSG91 service
            return res.status(501).json({ error: 'OTP verification not configured for production' });
        }

        let user = await prisma.user.findFirst({ where: { phone } });

        if (!user) {
            const rolePrefix = role === 'partner' ? 'PART-' : role === 'rider' ? 'RIDE-' : 'CUST-';
            const zoiId = rolePrefix + Math.floor(100000 + Math.random() * 900000);
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash('otp_generated_' + Date.now(), salt);

            user = await prisma.user.create({
                data: { zoiId, name: 'Guest User', phone, email: `${phone}@zipzapzoi.temp`, role: role || 'Customer', passwordHash }
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, zoiId: user.zoiId, name: user.name },
            getSecret(), { expiresIn: '24h' }
        );

        // Resolve Restaurant Context for Partners/Staff
        let restaurantId = null;
        const roleLower = (user.role || '').toLowerCase();
        if (roleLower === 'partner') {
            const rest = await prisma.restaurant.findFirst({ 
                where: { OR: [{ ownerEmail: user.email }, { phone: user.phone }] } 
            });
            if (rest) restaurantId = rest.id;
        } else if (roleLower === 'pos_staff') {
            const staff = await prisma.restaurantStaff.findFirst({ 
                where: { OR: [{ email: user.email }, { phone: user.phone }] } 
            });
            if (staff) restaurantId = staff.restaurantId;
        }

        res.json({
            message: 'OTP verified successfully', token,
            user: { 
                id: user.id, name: user.name, role: user.role, zoiId: user.zoiId, 
                email: user.email, phone: user.phone, restaurantId 
            }
        });
    } catch (error) { next(error); }
});

app.get('/api/auth/google-client-id', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google OAuth not configured' });
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

app.post('/api/auth/google', async (req, res, next) => {
    try {
        const { credential } = req.body;
        let payload;

        if (googleClient) {
            const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
            payload = ticket.getPayload();
        } else if (process.env.DEMO_MODE === 'true') {
            payload = JSON.parse(Buffer.from(credential.split('.')[1], 'base64').toString('utf8'));
        } else {
            return res.status(501).json({ error: 'Google OAuth not configured' });
        }

        const { email, name, picture } = payload;
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    zoiId: 'CUST-' + Math.floor(100000 + Math.random() * 900000),
                    name, email, role: 'Customer', avatar: picture
                }
            });
            notifications.sendEmail(user.email, "Welcome to ZoiEats", `Hi ${user.name},\n\nWe're thrilled to have you!`);
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, zoiId: user.zoiId, name: user.name, email: user.email },
            getSecret(), { expiresIn: '24h' }
        );
        res.json({ token, user: { id: user.id, name: user.name, role: user.role, zoiId: user.zoiId, email: user.email }, message: 'Google Login Successful' });
    } catch (error) { next(error); }
});

// Get current user profile from JWT
app.get('/api/auth/me', verifyToken, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, zoiId: true, name: true, email: true, phone: true, role: true, avatar: true, status: true, createdAt: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) { next(error); }
});

app.patch('/api/users/:id/status', verifyToken, requireRole('Super Admin'), async (req, res, next) => {
    try {
        const { status } = req.body;
        const user = await prisma.user.update({
            where: { zoiId: req.params.id },
            data: { status }
        });
        res.json({ message: 'Status updated', user });
    } catch (error) { next(error); }
});

// Update user role (Promotion/Demotion)
app.patch('/api/users/:id/role', verifyToken, requireRole('Super Admin'), async (req, res, next) => {
    try {
        const { role } = req.body;
        const user = await prisma.user.update({
            where: { zoiId: req.params.id },
            data: { role }
        });
        res.json({ message: 'Role updated', user });
    } catch (error) { next(error); }
});

// Update current user profile
app.put('/api/auth/me', verifyToken, async (req, res, next) => {
    try {
        const { name, phone, avatar } = req.body;
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { ...(name && { name }), ...(phone && { phone }), ...(avatar && { avatar }) }
        });
        res.json({ message: 'Profile updated', user: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone } });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// USERS API (Admin)
// ════════════════════════════════════════════════════════
app.get('/api/users', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const { role, status } = req.query;
        const where = {};
        if (role) where.role = role;
        if (status) where.status = status;
        const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(users);
    } catch (error) { next(error); }
});

app.put('/api/users/:id/status', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const { status } = req.body;
        const user = await prisma.user.update({ where: { id: parseInt(req.params.id) }, data: { status } });
        res.json({ message: 'User status updated', user });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// RESTAURANTS API
// ════════════════════════════════════════════════════════
app.get('/api/restaurants', async (req, res, next) => {
    try {
        const { status, zone } = req.query;
        const where = {};
        if (status) where.status = status;
        if (zone) where.zone = zone;
        const restaurants = await prisma.restaurant.findMany({ where, include: { menus: true }, orderBy: { createdAt: 'desc' } });
        res.json(restaurants);
    } catch (error) { next(error); }
});

app.get('/api/restaurants/:id', async (req, res, next) => {
    try {
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { menus: true, reviews: { orderBy: { createdAt: 'desc' }, take: 20 } }
        });
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
        res.json(restaurant);
    } catch (error) { next(error); }
});

app.post('/api/restaurants', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const data = req.body;
        if (!data.zoiId) data.zoiId = 'REST-' + Math.floor(100000 + Math.random() * 900000);
        const newRestaurant = await prisma.restaurant.create({ data });
        res.status(201).json(newRestaurant);
    } catch (error) { next(error); }
});

app.put('/api/restaurants/:id', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const updated = await prisma.restaurant.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// MENUS API
// ════════════════════════════════════════════════════════
app.get('/api/menus/:restaurantId', async (req, res, next) => {
    try {
        const menus = await prisma.menu.findMany({
            where: { restaurantId: parseInt(req.params.restaurantId) },
            orderBy: { category: 'asc' }
        });
        res.json(menus);
    } catch (error) { next(error); }
});

app.post('/api/menus', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const menu = await prisma.menu.create({ data: req.body });
        res.status(201).json(menu);
    } catch (error) { next(error); }
});

app.put('/api/menus/:id', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const updated = await prisma.menu.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

app.delete('/api/menus/:id', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        await prisma.menu.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Menu item deleted' });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// TABLES API
// ════════════════════════════════════════════════════════
app.get('/api/tables', async (req, res, next) => {
    try {
        const { restaurantId } = req.query;
        const where = restaurantId ? { restaurantId: parseInt(restaurantId) } : {};
        const tables = await prisma.table.findMany({ where, orderBy: { tableNumber: 'asc' } });
        res.json(tables);
    } catch (error) { next(error); }
});

app.post('/api/tables', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const table = await prisma.table.create({ data: req.body });
        res.status(201).json(table);
    } catch (error) { next(error); }
});

app.patch('/api/tables/:id', verifyToken, async (req, res, next) => {
    try {
        const updated = await prisma.table.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(updated);
        io.emit('table_update', updated);
    } catch (error) { next(error); }
});

app.delete('/api/tables/:id', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        await prisma.table.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Table deleted' });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ORDERS API
// ════════════════════════════════════════════════════════
app.get('/api/orders', verifyToken, async (req, res, next) => {
    try {
        const { zone, status, restaurantId } = req.query;
        const where = {};
        if (zone) where.zone = zone;
        if (status) where.status = status;
        if (restaurantId) where.restaurantId = parseInt(restaurantId);

        // Role-based filtering
        const userRole = (req.user.role || '').toLowerCase();
        if (!['super admin', 'admin'].includes(userRole)) {
            if (userRole === 'rider') {
                // Riders see orders assigned to them OR unassigned pending orders in their zone
                where.OR = [
                    { riderId: req.user.id },
                    { status: 'Pending', riderId: null, zone: zone || undefined }
                ];
                // Remove the top-level zone/status/riderId if we are using OR
                if (zone) delete where.zone;
                if (status) delete where.status;
            } else {
                where.userId = req.user.id;
            }
        }

        const orders = await prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
        res.json({ data: orders });
    } catch (error) { next(error); }
});

app.get('/api/orders/:id', verifyToken, async (req, res, next) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { restaurant: { select: { name: true, phone: true } }, user: { select: { name: true, phone: true, email: true } } }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) { next(error); }
});

app.post('/api/orders', optionalToken, validate.validateCreateOrder, async (req, res, next) => {
    try {
        const { restaurantId, customerId, items, totalAmount, deliveryAddress, zone, paymentMethod, type, tableId } = req.body;
        const zoiId = "ORD-" + Math.floor(100000 + Math.random() * 900000);

        const userId = req.user?.id || (customerId ? parseInt(customerId) : null);

        const newOrder = await prisma.order.create({
            data: {
                zoiId, restaurantId: parseInt(restaurantId),
                userId, items: typeof items === 'string' ? items : JSON.stringify(items),
                total: parseFloat(totalAmount), status: 'Pending',
                deliveryAddress, zone, paymentMethod: paymentMethod || 'UPI',
                type: type || 'Delivery', tableId: tableId ? tableId.toString() : null
            }
        });

        // Update Table status if it's a Dine-In order
        if (type === 'DINE_IN' && tableId) {
            try {
                const updatedTable = await prisma.table.update({
                    where: { id: parseInt(tableId) },
                    data: { status: 'Occupied' }
                });
                io.emit('table_update', updatedTable);
            } catch (e) { console.error("Table status update failed:", e.message); }
        }

        res.status(201).json({ data: newOrder });

        // Broadcast to real-time listeners
        io.emit('new_order', newOrder);
        io.to(`restaurant_${restaurantId}`).emit('new_order', newOrder);

        // Send notification
        try {
            if (userId) {
                const customer = await prisma.user.findUnique({ where: { id: userId } });
                if (customer) notifications.sendOrderConfirmation(customer, newOrder);
            }
        } catch (e) { console.error("Notification error:", e.message); }

    } catch (error) { next(error); }
});

app.put('/api/orders/:id/status', verifyToken, validate.validateUpdateOrderStatus, async (req, res, next) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status, riderId } = req.body;

        const previousOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (!previousOrder) return res.status(404).json({ error: "Order not found" });

        const updateData = { status };
        if (riderId) updateData.riderId = parseInt(riderId);

        // Build tracking log
        const existingTracking = previousOrder.tracking ? (typeof previousOrder.tracking === 'string' ? JSON.parse(previousOrder.tracking) : previousOrder.tracking) : [];
        existingTracking.push({ status, time: new Date().toISOString(), desc: `Order is now ${status}` });
        updateData.tracking = existingTracking;

        const updatedOrder = await prisma.order.update({ where: { id: orderId }, data: updateData });

        // ESCROW PAYOUT on delivery (atomic transaction)
        if (status === 'Delivered' && previousOrder.status !== 'Delivered') {
            await processEscrowPayout(updatedOrder);
        }

        // If order completed, free up the table
        if ((status === 'Delivered' || status === 'Completed') && updatedOrder.tableId) {
            try {
                const updatedTable = await prisma.table.update({
                    where: { id: parseInt(updatedOrder.tableId) },
                    data: { status: 'Available' }
                });
                io.emit('table_update', updatedTable);
            } catch (e) { console.error("Table release failed:", e.message); }
        }

        res.json({ data: updatedOrder });
        io.emit('order_status_update', updatedOrder);

        // Notify customer via email + push notification
        try {
            if (updatedOrder.userId) {
                const customer = await prisma.user.findUnique({ where: { id: updatedOrder.userId } });
                if (customer) {
                    notifications.sendOrderStatusUpdate(customer, updatedOrder);
                    // Auto-push notification to user's devices
                    notifications.sendPushToUser(prisma, updatedOrder.userId, {
                        title: `Order ${updatedOrder.zoiId}: ${status}`,
                        body: `Your order is now ${status}`,
                        url: '/customer%20order_tracking.html'
                    });
                }
            }
        } catch (e) { console.error("Notification error:", e.message); }

    } catch (error) { next(error); }
});

// User's order history
app.get('/api/orders/user/:userId', verifyToken, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        // Users can only see their own, admins can see anyone's
        const userRole = (req.user.role || '').toLowerCase();
        if (req.user.id !== userId && !['super admin', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const orders = await prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { restaurant: { select: { name: true, image: true } } }
        });
        res.json({ data: orders });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ESCROW / WALLET LOGIC (ATOMIC)
// ════════════════════════════════════════════════════════
async function getOrCreateWallet(entityId, entityType) {
    let wallet = await prisma.wallet.findUnique({ where: { entityId } });
    if (!wallet) {
        wallet = await prisma.wallet.create({ data: { entityId, entityType } });
    }
    return wallet;
}

async function processEscrowPayout(order) {
    const total = Number(order.total) || 0;
    if (total <= 0) return;

    const platformAmount = Math.round(total * 0.10 * 100) / 100;
    const restWalletId = `REST-${order.restaurantId}`;
    const riderWalletId = order.riderId ? `RIDE-${order.riderId}` : null;

    // Use Prisma interactive transaction for atomicity
    await prisma.$transaction(async (tx) => {
        const platformWallet = await getOrCreateWalletTx(tx, 'ADMIN', 'Admin');
        const partnerWallet = await getOrCreateWalletTx(tx, restWalletId, 'Restaurant');

        // Platform fee
        await tx.wallet.update({ where: { id: platformWallet.id }, data: { balance: { increment: platformAmount } } });
        await tx.transaction.create({ data: { walletId: platformWallet.id, type: 'CREDIT', amount: platformAmount, description: `Platform fee for Order ${order.zoiId}`, orderId: order.id } });

        if (riderWalletId) {
            const riderAmount = Math.round(total * 0.10 * 100) / 100;
            const partnerAmount = Math.round((total - platformAmount - riderAmount) * 100) / 100;

            const riderWallet = await getOrCreateWalletTx(tx, riderWalletId, 'Rider');
            await tx.wallet.update({ where: { id: riderWallet.id }, data: { balance: { increment: riderAmount } } });
            await tx.transaction.create({ data: { walletId: riderWallet.id, type: 'CREDIT', amount: riderAmount, description: `Delivery fee for Order ${order.zoiId}`, orderId: order.id } });

            await tx.wallet.update({ where: { id: partnerWallet.id }, data: { balance: { increment: partnerAmount } } });
            await tx.transaction.create({ data: { walletId: partnerWallet.id, type: 'CREDIT', amount: partnerAmount, description: `Order Payout for ${order.zoiId}`, orderId: order.id } });
        } else {
            const partnerAmount = Math.round((total - platformAmount) * 100) / 100;
            await tx.wallet.update({ where: { id: partnerWallet.id }, data: { balance: { increment: partnerAmount } } });
            await tx.transaction.create({ data: { walletId: partnerWallet.id, type: 'CREDIT', amount: partnerAmount, description: `Order Payout for ${order.zoiId}`, orderId: order.id } });
        }
    });
    console.log(`💰 Escrow Payout Processed (atomic) for Order ${order.zoiId}`);
}

async function getOrCreateWalletTx(tx, entityId, entityType) {
    let wallet = await tx.wallet.findUnique({ where: { entityId } });
    if (!wallet) {
        wallet = await tx.wallet.create({ data: { entityId, entityType } });
    }
    return wallet;
}

// ════════════════════════════════════════════════════════
// WALLET API
// ════════════════════════════════════════════════════════
app.get('/api/wallet/:entityId', verifyToken, async (req, res, next) => {
    try {
        const { entityId } = req.params;
        let wallet = await prisma.wallet.findUnique({
            where: { entityId },
            include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } }
        });
        if (!wallet) wallet = { balance: 0, transactions: [] };
        res.json(wallet);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// RAZORPAY PAYMENT API
// ════════════════════════════════════════════════════════

// Public endpoint: returns only the key_id (safe to expose)
app.get('/api/payments/config', (req, res) => {
    res.json({
        key_id: process.env.RAZORPAY_KEY_ID || null,
        currency: 'INR',
        name: 'ZipZapZoi Eats',
        description: 'Food Delivery Payment',
        theme_color: '#00f0ff',
        is_live: (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_live_')
    });
});

app.post('/api/payments/create-order', optionalToken, validate.validateCreatePayment, async (req, res, next) => {
    try {
        if (!razorpay) return res.status(503).json({ error: 'Payment gateway not configured' });

        const { amount, currency = "INR", receipt } = req.body;
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency,
            receipt: receipt || 'rcpt_' + Date.now()
        });

        res.json({
            id: order.id, currency: order.currency, amount: order.amount,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) { next(error); }
});

app.post('/api/payments/verify', validate.validateVerifyPayment, async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const digest = shasum.digest("hex");

        if (digest !== razorpay_signature) {
            return res.status(400).json({ error: "Transaction not legit!" });
        }

        // Update order payment status if we can find it
        const order = await prisma.order.findFirst({ where: { razorpayOrderId: razorpay_order_id } });
        if (order) {
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentStatus: 'Paid', razorpayPaymentId: razorpay_payment_id }
            });
        }

        res.json({ message: "Payment successful", orderId: razorpay_order_id, paymentId: razorpay_payment_id });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// TABLES API
// ════════════════════════════════════════════════════════
app.get('/api/restaurants/:id/tables', async (req, res, next) => {
    try {
        const tables = await prisma.table.findMany({
            where: { restaurantId: parseInt(req.params.id) },
            orderBy: { tableNumber: 'asc' }
        });
        res.json(tables);
    } catch (error) { next(error); }
});

app.post('/api/tables', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const { restaurantId, tableNumber, capacity, status, qrCode } = req.body;
        const table = await prisma.table.create({
            data: {
                restaurantId: parseInt(restaurantId),
                tableNumber: tableNumber.toString(),
                capacity: parseInt(capacity || 2),
                status: status || 'Available',
                qrCode: qrCode || null
            }
        });
        res.status(201).json(table);
    } catch (error) { next(error); }
});

app.put('/api/tables/:id', verifyToken, async (req, res, next) => {
    try {
        const data = req.body;
        if (data.restaurantId) delete data.restaurantId; // Protected
        const updated = await prisma.table.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...data,
                capacity: data.capacity ? parseInt(data.capacity) : undefined
            }
        });
        res.json(updated);
        io.to(`restaurant_${updated.restaurantId}`).emit('table_update', updated);
    } catch (error) { next(error); }
});

app.delete('/api/tables/:id', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const table = await prisma.table.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Table deleted', table });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// SEARCH API
// ════════════════════════════════════════════════════════
app.get('/api/search', async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ restaurants: [], dishes: [] });

        const restaurants = await prisma.restaurant.findMany({
            where: {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { ownerName: { contains: q, mode: 'insensitive' } },
                    { tags: { hasSome: [q] } }
                ],
                status: 'Active'
            },
            take: 10
        });

        const dishes = await prisma.menu.findMany({
            where: {
                OR: [
                    { itemName: { contains: q, mode: 'insensitive' } },
                    { category: { contains: q, mode: 'insensitive' } }
                ],
                restaurant: { status: 'Active' }
            },
            include: { restaurant: { select: { name: true, id: true } } },
            take: 20
        });

        res.json({ restaurants, dishes });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ZONES API
// ════════════════════════════════════════════════════════
app.get('/api/zones', async (req, res, next) => {
    try {
        const zones = await prisma.zone.findMany();
        res.json(zones);
    } catch (error) { next(error); }
});

app.post('/api/zones', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const zone = await prisma.zone.create({ data: req.body });
        res.status(201).json(zone);
    } catch (error) { next(error); }
});

app.put('/api/zones/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const zone = await prisma.zone.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(zone);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// FEEDBACK API
// ════════════════════════════════════════════════════════
app.get('/api/feedback', verifyToken, async (req, res, next) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status) where.status = status;
        const userRole = (req.user.role || '').toLowerCase();
        if (!['super admin', 'admin'].includes(userRole)) {
            where.userId = req.user.id;
        }
        const feedbacks = await prisma.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
        res.json(feedbacks);
    } catch (error) { next(error); }
});

app.post('/api/feedback', optionalToken, validate.validateFeedback, async (req, res, next) => {
    try {
        const { message, rating, category, subject, priority } = req.body;
        const feedback = await prisma.feedback.create({
            data: {
                userId: req.user?.id || null,
                message, rating: rating || 5,
                category: category || 'General',
                subject: subject || '', priority: priority || 'Medium'
            }
        });
        res.status(201).json({ message: 'Feedback submitted. Thank you!', feedback });
    } catch (error) { next(error); }
});

app.put('/api/feedback/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const updated = await prisma.feedback.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// REVIEWS API
// ════════════════════════════════════════════════════════
app.get('/api/reviews/:restaurantId', async (req, res, next) => {
    try {
        const reviews = await prisma.review.findMany({
            where: { restaurantId: parseInt(req.params.restaurantId) },
            orderBy: { createdAt: 'desc' }, take: 50
        });
        res.json(reviews);
    } catch (error) { next(error); }
});

app.post('/api/reviews', optionalToken, async (req, res, next) => {
    try {
        const { restaurantId, rating, title, text, authorName, authorEmail } = req.body;
        const review = await prisma.review.create({
            data: {
                restaurantId: parseInt(restaurantId), rating: rating || 5,
                title, text,
                authorName: authorName || req.user?.name || 'Anonymous',
                authorEmail: authorEmail || req.user?.email
            }
        });

        // Update restaurant average rating
        const allReviews = await prisma.review.findMany({ where: { restaurantId: parseInt(restaurantId) }, select: { rating: true } });
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        await prisma.restaurant.update({ where: { id: parseInt(restaurantId) }, data: { rating: Math.round(avgRating * 10) / 10 } });

        res.status(201).json({ message: 'Review posted!', review });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// DISPUTES API
// ════════════════════════════════════════════════════════
app.get('/api/disputes', verifyToken, async (req, res, next) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status) where.status = status;
        const userRole = (req.user.role || '').toLowerCase();
        if (!['super admin', 'admin', 'dispute manager'].includes(userRole)) {
            where.userId = req.user.id;
        }
        const disputes = await prisma.dispute.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(disputes);
    } catch (error) { next(error); }
});

app.post('/api/disputes', optionalToken, async (req, res, next) => {
    try {
        const { title, description, orderId, type } = req.body;
        const ticketId = 'TKT-' + Math.floor(10000 + Math.random() * 90000);
        const dispute = await prisma.dispute.create({
            data: {
                ticketId, userId: req.user?.id || null,
                title, description, orderId, type: type || 'Standard',
                log: [{ role: 'system', msg: 'Ticket created', timestamp: new Date().toISOString() }]
            }
        });
        res.status(201).json({ message: 'Dispute created', dispute });
    } catch (error) { next(error); }
});

app.put('/api/disputes/:id', verifyToken, requireRole('Super Admin', 'admin', 'Dispute Manager'), async (req, res, next) => {
    try {
        const updated = await prisma.dispute.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// SUPPORT TICKETS API
// ════════════════════════════════════════════════════════
app.get('/api/support-tickets', verifyToken, async (req, res, next) => {
    try {
        const where = {};
        const userRole = (req.user.role || '').toLowerCase();
        if (!['super admin', 'admin'].includes(userRole)) where.userId = req.user.id;
        const tickets = await prisma.supportTicket.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(tickets);
    } catch (error) { next(error); }
});

app.post('/api/support-tickets', optionalToken, async (req, res, next) => {
    try {
        const { subject, category, message, priority } = req.body;
        const ticketId = 'TKT-' + Math.floor(10000 + Math.random() * 90000);
        const ticket = await prisma.supportTicket.create({
            data: { ticketId, userId: req.user?.id || null, subject, category: category || 'Other', message, priority: priority || 'Medium' }
        });
        res.status(201).json({ message: `Ticket ${ticketId} created`, ticket });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// PROMOTIONS API
// ════════════════════════════════════════════════════════
app.get('/api/promotions', async (req, res, next) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status) where.status = status;
        const promotions = await prisma.promotion.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(promotions);
    } catch (error) { next(error); }
});

app.post('/api/promotions/validate', async (req, res, next) => {
    try {
        const { code } = req.body;
        const promo = await prisma.promotion.findUnique({ where: { code } });
        if (!promo) return res.status(404).json({ error: 'Invalid promo code' });
        if (promo.status !== 'Active') return res.status(400).json({ error: `Promo code is ${promo.status}` });
        if (promo.used >= promo.maxUsage) return res.status(400).json({ error: 'Promo code usage limit reached' });
        if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return res.status(400).json({ error: 'Promo code expired' });

        res.json({ valid: true, promo });
    } catch (error) { next(error); }
});

app.post('/api/promotions', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const promo = await prisma.promotion.create({ data: req.body });
        res.status(201).json(promo);
    } catch (error) { next(error); }
});

app.put('/api/promotions/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const updated = await prisma.promotion.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// SUBSCRIPTIONS API
// ════════════════════════════════════════════════════════
app.get('/api/subscriptions', verifyToken, async (req, res, next) => {
    try {
        const userRole = (req.user.role || '').toLowerCase();
        const where = ['super admin', 'admin'].includes(userRole) ? {} : { userId: req.user.id };
        const subs = await prisma.userSubscription.findMany({ where, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } });
        res.json(subs);
    } catch (error) { next(error); }
});

app.post('/api/subscriptions', verifyToken, async (req, res, next) => {
    try {
        const { plan, price } = req.body;
        const sub = await prisma.userSubscription.create({
            data: { userId: req.user.id, plan, price: parseFloat(price) }
        });
        res.status(201).json({ message: `Subscribed to ${plan}!`, subscription: sub });
    } catch (error) { next(error); }
});

app.put('/api/subscriptions/:id', verifyToken, async (req, res, next) => {
    try {
        const updated = await prisma.userSubscription.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// RIDER APPLICATIONS API
// ════════════════════════════════════════════════════════
app.get('/api/rider-applications', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const apps = await prisma.riderApplication.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(apps);
    } catch (error) { next(error); }
});

app.post('/api/rider-applications', async (req, res, next) => {
    try {
        const { name, phone, city, vehicle } = req.body;
        const appId = 'APP-' + Math.floor(10000 + Math.random() * 90000);
        const app = await prisma.riderApplication.create({ data: { appId, name, phone, city, vehicle } });
        res.status(201).json({ message: 'Application submitted!', application: app });
    } catch (error) { next(error); }
});

app.put('/api/rider-applications/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const updated = await prisma.riderApplication.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// RESTAURANT APPLICATIONS API
// ════════════════════════════════════════════════════════
app.get('/api/restaurant-applications', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const apps = await prisma.restaurantApplication.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(apps);
    } catch (error) { next(error); }
});

app.post('/api/restaurant-applications', async (req, res, next) => {
    try {
        const appId = 'REQ-' + Math.floor(10000 + Math.random() * 90000);
        const app = await prisma.restaurantApplication.create({ data: { appId, ...req.body } });
        res.status(201).json({ message: 'Application submitted!', application: app });
    } catch (error) { next(error); }
});

app.put('/api/restaurant-applications/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const updated = await prisma.restaurantApplication.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// REFUNDS API
// ════════════════════════════════════════════════════════
app.get('/api/refunds', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status) where.status = status;
        const refunds = await prisma.refund.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(refunds);
    } catch (error) { next(error); }
});

app.post('/api/refunds', verifyToken, async (req, res, next) => {
    try {
        const refundId = 'R-' + Math.floor(10000 + Math.random() * 90000);
        const refund = await prisma.refund.create({ data: { refundId, ...req.body } });
        res.status(201).json(refund);
    } catch (error) { next(error); }
});

app.put('/api/refunds/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const updated = await prisma.refund.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ADMIN METRICS API
// ════════════════════════════════════════════════════════
app.get('/api/admin/metrics', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const [userCount, restaurantCount, orderCount, riderCount, feedbackCount] = await Promise.all([
            prisma.user.count(),
            prisma.restaurant.count(),
            prisma.order.count(),
            prisma.user.count({ where: { role: 'rider' } }),
            prisma.feedback.count()
        ]);

        const revenueResult = await prisma.order.aggregate({ _sum: { total: true }, where: { status: 'Delivered' } });
        const totalRevenue = revenueResult._sum.total || 0;

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayOrders = await prisma.order.count({ where: { createdAt: { gte: todayStart } } });

        res.json({
            users: userCount, restaurants: restaurantCount,
            orders: orderCount, riders: riderCount,
            feedbacks: feedbackCount, revenue: totalRevenue,
            todayOrders
        });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS (Persisted)
// ════════════════════════════════════════════════════════
app.post('/api/notifications/subscribe', optionalToken, async (req, res, next) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription' });

        await prisma.pushSubscription.upsert({
            where: { endpoint },
            update: { keys, userId: req.user?.id || null },
            create: { endpoint, keys, userId: req.user?.id || null }
        });
        res.status(201).json({ success: true });
    } catch (error) { next(error); }
});

app.post('/api/notifications/test', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const subs = await prisma.pushSubscription.findMany();
        const payload = JSON.stringify({
            title: req.body.title || 'Welcome to ZipZapZoi!',
            body: req.body.body || 'Your web push notifications are working.',
            url: req.body.url || '/'
        });

        const results = await Promise.allSettled(
            subs.map(sub => webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload))
        );
        const sent = results.filter(r => r.status === 'fulfilled').length;
        res.json({ message: `Push sent to ${sent}/${subs.length} subscribers` });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// CMS API
// ════════════════════════════════════════════════════════
app.get('/api/cms', async (req, res, next) => {
    try {
        const assets = await prisma.cmsAsset.findMany({ orderBy: { sortOrder: 'asc' } });
        res.json(assets);
    } catch (error) { next(error); }
});

app.post('/api/cms', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const asset = await prisma.cmsAsset.create({ data: req.body });
        res.status(201).json(asset);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// BADGES / GAMIFICATION API
// ════════════════════════════════════════════════════════
app.get('/api/badges', async (req, res, next) => {
    try {
        const badges = await prisma.badge.findMany();
        res.json(badges);
    } catch (error) { next(error); }
});

app.post('/api/badges', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const badge = await prisma.badge.create({ data: req.body });
        res.status(201).json(badge);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// INVENTORY API
// ════════════════════════════════════════════════════════
app.get('/api/inventory/:restaurantId', verifyToken, async (req, res, next) => {
    try {
        const items = await prisma.inventoryItem.findMany({
            where: { restaurantId: parseInt(req.params.restaurantId) }
        });
        res.json(items);
    } catch (error) { next(error); }
});

app.post('/api/inventory', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const item = await prisma.inventoryItem.create({ data: req.body });
        res.status(201).json(item);
    } catch (error) { next(error); }
});

app.put('/api/inventory/:id', verifyToken, requireRole('Super Admin', 'admin', 'partner'), async (req, res, next) => {
    try {
        const updated = await prisma.inventoryItem.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// MEDIA UPLOAD API
// ════════════════════════════════════════════════════════
app.post('/api/upload', uploadService.uploadMiddleware, uploadService.handleUpload);

// ════════════════════════════════════════════════════════
// ERROR HANDLER (must be last)
// ════════════════════════════════════════════════════════
app.use(errorHandler);

// ─── DISPUTES ───────────────────────────────────────────
app.get('/api/disputes', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const disputes = await prisma.dispute.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(disputes);
    } catch (error) { next(error); }
});

app.get('/api/disputes/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const dispute = await prisma.dispute.findUnique({
            where: { ticketId: req.params.id },
            include: { user: true }
        });
        if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
        res.json(dispute);
    } catch (error) { next(error); }
});

app.patch('/api/disputes/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const { status, resolution, resolutionNote, assignedTo } = req.body;
        const dispute = await prisma.dispute.update({
            where: { ticketId: req.params.id },
            data: { status, resolution, resolutionNote, assignedTo }
        });
        res.json(dispute);
    } catch (error) { next(error); }
});

app.post('/api/disputes/:id/log', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const { role, msg } = req.body;
        const dispute = await prisma.dispute.findUnique({ where: { ticketId: req.params.id } });
        if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

        const currentLog = Array.isArray(dispute.log) ? dispute.log : [];
        const newLogEntry = { role, msg, timestamp: new Date().toISOString() };
        
        const updatedDispute = await prisma.dispute.update({
            where: { ticketId: req.params.id },
            data: { log: [...currentLog, newLogEntry] }
        });
        res.json(updatedDispute);
    } catch (error) { next(error); }
});

// ─── CMS ASSETS ─────────────────────────────────────────
app.get('/api/cms/assets', async (req, res, next) => {
    try {
        const assets = await prisma.cmsAsset.findMany({
            where: { status: 'Active' },
            orderBy: { sortOrder: 'asc' }
        });
        res.json(assets);
    } catch (error) { next(error); }
});

app.post('/api/cms/assets', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const asset = await prisma.cmsAsset.create({ data: req.body });
        res.json(asset);
    } catch (error) { next(error); }
});

app.put('/api/cms/assets/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const asset = await prisma.cmsAsset.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(asset);
    } catch (error) { next(error); }
});

app.delete('/api/cms/assets/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        await prisma.cmsAsset.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Asset deleted' });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ERROR HANDLERS (must be after all routes)
// ════════════════════════════════════════════════════════

// API 404 handler
app.all('/api/{*path}', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// Frontend catch-all: serve index.html for any unmatched routes (deep-linking support)
app.get('{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Unknown error';

    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// ════════════════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════════════════
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🚀 Z.O.I. Backend active on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Demo Mode: ${process.env.DEMO_MODE === 'true' ? 'ON' : 'OFF'}`);
    console.log(`   CORS Origins: ${corsOrigins.join(', ')}\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await prisma.$disconnect();
    server.close(() => process.exit(0));
});
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
});
