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
const { GoogleGenAI } = require('@google/genai');
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
app.set('trust proxy', true);
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

const getClientIp = (req) => {
    return req.headers['cf-connecting-ip'] || 
           (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
           req.ip;
};

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased limit for production
    keyGenerator: getClientIp,
    message: { error: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased auth limit to avoid accidental blocking on shared networks
    keyGenerator: getClientIp,
    message: { error: 'Too many auth attempts, please try again later.' }
});
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ─── PAGINATION HELPER ──────────────────────────────────
function paginate(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    return { skip: (page - 1) * limit, take: limit, page, limit };
}

// ─── WEBSOCKETS ─────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('📡 Client connected:', socket.id);

    // Join a named room (restaurant_1, rider_R01, order_ORD-1001)
    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    // Leave a room
    socket.on('leave_room', (room) => {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
    });

    // Rider location broadcast — relayed to order's customer tracking page
    socket.on('rider_location', (data) => {
        // data: { riderId, orderId, lat, lng }
        if (data.orderId) {
            io.to(`order_${data.orderId}`).emit('rider_location', data);
        }
        if (data.riderId) {
            io.to(`rider_${data.riderId}`).emit('rider_location', data);
        }
    });

    // Chat messages (admin / support)
    socket.on('chat_message', (msg) => {
        io.emit('chat_message', { ...msg, timestamp: new Date() });
    });

    // Ping/pong heartbeat for connection health
    socket.on('ping_zoi', () => {
        socket.emit('pong_zoi', { ts: Date.now() });
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
        const { skip, take, page, limit } = paginate(req.query);
        const where = {};
        if (role) where.role = role;
        if (status) where.status = status;
        const [users, total] = await Promise.all([
            prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
            prisma.user.count({ where })
        ]);
        res.json({ data: users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
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
        const { skip, take, page, limit } = paginate(req.query);
        const where = {};
        if (status) where.status = status;
        if (zone) where.zone = zone;
        const [restaurants, total] = await Promise.all([
            prisma.restaurant.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
            prisma.restaurant.count({ where })
        ]);
        res.json({ data: restaurants, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
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

app.delete('/api/restaurants/:id', verifyToken, requireRole('Super Admin', 'admin'), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        // Soft-delete: set status to Suspended instead of hard delete to preserve order history
        const restaurant = await prisma.restaurant.update({ where: { id }, data: { status: 'Suspended' } });
        res.json({ message: 'Restaurant suspended', restaurant });
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
        const { skip, take, page, limit } = paginate(req.query);
        const where = {};
        if (zone) where.zone = zone;
        if (status) where.status = status;
        if (restaurantId) where.restaurantId = parseInt(restaurantId);

        // Role-based filtering
        const userRole = (req.user.role || '').toLowerCase();
        if (!['super admin', 'admin'].includes(userRole)) {
            if (userRole === 'rider') {
                where.OR = [
                    { riderId: req.user.id },
                    { status: 'Pending', riderId: null, zone: zone || undefined }
                ];
                if (zone) delete where.zone;
                if (status) delete where.status;
            } else {
                where.userId = req.user.id;
            }
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
            prisma.order.count({ where })
        ]);
        res.json({ data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
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

// Guest order tracking — no auth required, lookup by zoiId
app.get('/api/orders/track/:zoiId', async (req, res, next) => {
    try {
        const order = await prisma.order.findUnique({
            where: { zoiId: req.params.zoiId },
            select: { id: true, zoiId: true, status: true, tracking: true, type: true, total: true, createdAt: true, restaurant: { select: { name: true } } }
        });
        if (!order) return res.status(404).json({ error: 'Order not found. Check your Order ID.' });
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
        const userRole = (req.user.role || '').toLowerCase();
        if (req.user.id !== userId && !['super admin', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { skip, take, page, limit } = paginate(req.query);
        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: { restaurant: { select: { name: true, image: true } } },
                skip, take
            }),
            prisma.order.count({ where: { userId } })
        ]);
        res.json({ data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ORDER CANCELLATION
// ════════════════════════════════════════════════════════
app.post('/api/orders/:id/cancel', verifyToken, async (req, res, next) => {
    try {
        const orderId = parseInt(req.params.id);
        const { reason } = req.body;
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Only allow cancellation for Pending or Confirmed orders
        if (!['Pending', 'Confirmed'].includes(order.status)) {
            return res.status(400).json({ error: `Cannot cancel order in '${order.status}' status. Only Pending or Confirmed orders can be cancelled.` });
        }

        // Only the order owner or admin can cancel
        const userRole = (req.user.role || '').toLowerCase();
        if (order.userId !== req.user.id && !['super admin', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update order status
        const tracking = Array.isArray(order.tracking) ? order.tracking : [];
        tracking.push({ status: 'Cancelled', time: new Date().toISOString(), desc: reason || 'Cancelled by user' });

        const cancelled = await prisma.order.update({
            where: { id: orderId },
            data: { status: 'Cancelled', tracking }
        });

        // Auto-create refund if payment was made
        if (order.paymentStatus === 'Paid') {
            const refundId = 'R-' + Math.floor(10000 + Math.random() * 90000);
            await prisma.refund.create({
                data: {
                    refundId,
                    orderId: order.zoiId,
                    customerName: req.user.name || 'Customer',
                    reason: reason || 'Order cancelled',
                    amount: order.total,
                    paymentMethod: order.paymentMethod,
                    status: 'Pending',
                    description: `Auto-refund for cancelled order ${order.zoiId}`
                }
            });
            // Mark payment as refunded
            await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'Refunded' } });
        }

        res.json({ message: 'Order cancelled successfully', order: cancelled });
        io.emit('order_status_update', cancelled);
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

// Wallet withdrawal request
app.post('/api/wallet/:entityId/withdraw', verifyToken, async (req, res, next) => {
    try {
        const { entityId } = req.params;
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        const wallet = await prisma.wallet.findUnique({ where: { entityId } });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
        if (wallet.balance < amount) return res.status(400).json({ error: `Insufficient balance. Available: ₹${wallet.balance.toFixed(2)}` });

        // Atomic debit
        await prisma.$transaction(async (tx) => {
            await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });
            await tx.transaction.create({
                data: { walletId: wallet.id, type: 'DEBIT', amount, description: `Withdrawal of ₹${amount}` }
            });
        });

        const updated = await prisma.wallet.findUnique({ where: { entityId }, include: { transactions: { orderBy: { createdAt: 'desc' }, take: 5 } } });
        res.json({ message: `₹${amount} withdrawn successfully`, wallet: updated });
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
                    { category: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } }
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

app.put('/api/disputes/:id', verifyToken, requireRole('Super Admin', 'admin', 'dispute manager'), async (req, res, next) => {
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

// Redeem a promo code (increments the used counter)
app.post('/api/promotions/redeem', optionalToken, async (req, res, next) => {
    try {
        const { code } = req.body;
        const promo = await prisma.promotion.findUnique({ where: { code } });
        if (!promo) return res.status(404).json({ error: 'Invalid promo code' });
        if (promo.status !== 'Active') return res.status(400).json({ error: `Promo code is ${promo.status}` });
        if (promo.used >= promo.maxUsage) return res.status(400).json({ error: 'Promo code usage limit reached' });

        const updated = await prisma.promotion.update({
            where: { code },
            data: { used: { increment: 1 } }
        });
        res.json({ message: 'Promo redeemed', promo: updated });
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
// PARTNER DASHBOARD API
// ════════════════════════════════════════════════════════
app.get('/api/partner/dashboard/:restaurantId', verifyToken, async (req, res, next) => {
    try {
        const restId = parseInt(req.params.restaurantId);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

        const [restaurant, todayRevAgg, todayOrderCount, activeOrders, recentOrders, lowStock, reviewAgg] = await Promise.all([
            prisma.restaurant.findUnique({ where: { id: restId }, select: { id: true, name: true, rating: true, status: true, image: true } }),
            prisma.order.aggregate({ where: { restaurantId: restId, createdAt: { gte: todayStart }, paymentStatus: 'Paid' }, _sum: { total: true } }),
            prisma.order.count({ where: { restaurantId: restId, createdAt: { gte: todayStart } } }),
            prisma.order.findMany({ where: { restaurantId: restId, status: { in: ['Pending', 'Confirmed', 'Preparing'] } }, orderBy: { createdAt: 'desc' }, take: 20,
                select: { id: true, zoiId: true, total: true, status: true, type: true, items: true, createdAt: true, user: { select: { name: true } } } }),
            prisma.order.findMany({ where: { restaurantId: restId }, orderBy: { createdAt: 'desc' }, take: 10,
                select: { id: true, zoiId: true, total: true, status: true, type: true, createdAt: true, user: { select: { name: true } } } }),
            prisma.inventoryItem.count({ where: { restaurantId: restId, currentStock: { lte: 5 } } }).catch(() => 0),
            prisma.review.aggregate({ where: { restaurantId: restId }, _avg: { rating: true }, _count: true }).catch(() => ({ _avg: { rating: null }, _count: 0 })),
        ]);

        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

        res.json({
            restaurant,
            sales: { today: todayRevAgg._sum.total || 0 },
            orders: { today: todayOrderCount, active: activeOrders.length,
                activeList: activeOrders.map(o => ({ id: o.zoiId || `ORD-${o.id}`, total: o.total, status: o.status, type: o.type, items: o.items, customer: o.user?.name || 'Guest', time: o.createdAt })),
                recentList: recentOrders.map(o => ({ id: o.zoiId || `ORD-${o.id}`, total: o.total, status: o.status, customer: o.user?.name || 'Guest', time: o.createdAt }))
            },
            rating: { avg: reviewAgg._avg.rating || restaurant.rating || 0, count: reviewAgg._count || 0 },
            lowStock,
        });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// RIDER DASHBOARD API
// ════════════════════════════════════════════════════════
app.get('/api/rider/dashboard', verifyToken, async (req, res, next) => {
    try {
        const riderId = req.user.id;
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

        const [todayTrips, todayEarnings, wallet] = await Promise.all([
            prisma.order.findMany({ where: { riderId, createdAt: { gte: todayStart }, status: 'Delivered' }, orderBy: { createdAt: 'desc' },
                select: { id: true, zoiId: true, total: true, createdAt: true, restaurant: { select: { name: true } }, deliveryAddress: true } }),
            prisma.order.aggregate({ where: { riderId, createdAt: { gte: todayStart }, status: 'Delivered' }, _sum: { total: true } }),
            prisma.wallet.findUnique({ where: { entityId: req.user.zoiId || `RIDE-${riderId}` } }).catch(() => null),
        ]);

        // Estimate rider earnings as 15% of order total
        const earningsRate = 0.15;
        const totalEarnings = todayTrips.reduce((s, o) => s + (parseFloat(o.total) || 0) * earningsRate, 0);

        res.json({
            earnings: { today: Math.round(totalEarnings) },
            trips: { today: todayTrips.length,
                history: todayTrips.map(t => ({ id: t.zoiId || `ORD-${t.id}`, restaurant: t.restaurant?.name || 'Unknown', amount: Math.round((parseFloat(t.total) || 0) * earningsRate), time: t.createdAt, address: t.deliveryAddress }))
            },
            wallet: { balance: wallet?.balance || 0 },
        });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// PARTNER KDS / REVIEWS / MENU API
// ════════════════════════════════════════════════════════

// KDS Live Orders
app.get('/api/partner/orders/:restaurantId', verifyToken, async (req, res, next) => {
    try {
        const restId = parseInt(req.params.restaurantId);
        const orders = await prisma.order.findMany({
            where: { restaurantId: restId, status: { in: ['Pending', 'Confirmed', 'Preparing', 'Ready'] } },
            orderBy: { createdAt: 'desc' }, take: 30,
            select: { id: true, zoiId: true, total: true, status: true, type: true, items: true, createdAt: true, deliveryAddress: true, user: { select: { name: true, phone: true } } }
        });
        res.json({ orders: orders.map(o => ({ id: o.zoiId || `ORD-${o.id}`, dbId: o.id, total: o.total, status: o.status, type: o.type || 'Delivery', items: o.items || [], customer: o.user?.name || 'Guest', phone: o.user?.phone || '', address: o.deliveryAddress || '', time: o.createdAt, elapsed: Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000) })) });
    } catch (error) { next(error); }
});

// Partner Reviews
app.get('/api/partner/reviews/:restaurantId', verifyToken, async (req, res, next) => {
    try {
        const restId = parseInt(req.params.restaurantId);
        const [reviews, agg] = await Promise.all([
            prisma.review.findMany({ where: { restaurantId: restId }, orderBy: { createdAt: 'desc' }, take: 20 }),
            prisma.review.aggregate({ where: { restaurantId: restId }, _avg: { rating: true }, _count: true })
        ]);
        res.json({ reviews, avg: agg._avg.rating || 0, count: agg._count || 0 });
    } catch (error) { next(error); }
});

// Partner Menu Items
app.get('/api/partner/menu/:restaurantId', verifyToken, async (req, res, next) => {
    try {
        const restId = parseInt(req.params.restaurantId);
        const items = await prisma.menu.findMany({ where: { restaurantId: restId }, orderBy: [{ category: 'asc' }, { itemName: 'asc' }] });
        // Group by category
        const grouped = {};
        items.forEach(i => { if (!grouped[i.category]) grouped[i.category] = []; grouped[i.category].push(i); });
        res.json({ items, grouped, total: items.length });
    } catch (error) { next(error); }
});

// Toggle menu item availability
app.patch('/api/partner/menu/:itemId/toggle', verifyToken, async (req, res, next) => {
    try {
        const item = await prisma.menu.findUnique({ where: { id: parseInt(req.params.itemId) } });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        const updated = await prisma.menu.update({ where: { id: item.id }, data: { isAvailable: !item.isAvailable } });
        res.json(updated);
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
// FAVORITES API
// ════════════════════════════════════════════════════════
app.get('/api/favorites', verifyToken, async (req, res, next) => {
    try {
        const favorites = await prisma.favorite.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(favorites);
    } catch (error) { next(error); }
});

app.post('/api/favorites/toggle', verifyToken, async (req, res, next) => {
    try {
        const { type, restaurantId, menuItemId } = req.body;
        const where = { userId_type_restaurantId_menuItemId: { userId: req.user.id, type, restaurantId: restaurantId || null, menuItemId: menuItemId || null } };

        const existing = await prisma.favorite.findUnique({ where });
        if (existing) {
            await prisma.favorite.delete({ where });
            res.json({ message: 'Removed from favorites', favorited: false });
        } else {
            const fav = await prisma.favorite.create({ data: { userId: req.user.id, type, restaurantId, menuItemId } });
            res.json({ message: 'Added to favorites', favorited: true, favorite: fav });
        }
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ADDRESSES API
// ════════════════════════════════════════════════════════
app.get('/api/addresses', verifyToken, async (req, res, next) => {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId: req.user.id },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
        });
        res.json(addresses);
    } catch (error) { next(error); }
});

app.post('/api/addresses', verifyToken, async (req, res, next) => {
    try {
        const { label, address, landmark, lat, lng, isDefault } = req.body;

        // If setting as default, unset all others first
        if (isDefault) {
            await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
        }

        const newAddr = await prisma.address.create({
            data: { userId: req.user.id, label: label || 'Home', address, landmark, lat, lng, isDefault: isDefault || false }
        });
        res.status(201).json(newAddr);
    } catch (error) { next(error); }
});

app.put('/api/addresses/:id', verifyToken, async (req, res, next) => {
    try {
        const addr = await prisma.address.findFirst({ where: { id: parseInt(req.params.id), userId: req.user.id } });
        if (!addr) return res.status(404).json({ error: 'Address not found' });

        if (req.body.isDefault) {
            await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
        }

        const updated = await prisma.address.update({ where: { id: addr.id }, data: req.body });
        res.json(updated);
    } catch (error) { next(error); }
});

app.delete('/api/addresses/:id', verifyToken, async (req, res, next) => {
    try {
        const addr = await prisma.address.findFirst({ where: { id: parseInt(req.params.id), userId: req.user.id } });
        if (!addr) return res.status(404).json({ error: 'Address not found' });
        await prisma.address.delete({ where: { id: addr.id } });
        res.json({ message: 'Address deleted' });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// NOTIFICATIONS API
// ════════════════════════════════════════════════════════
app.get('/api/notifications', verifyToken, async (req, res, next) => {
    try {
        const { skip, take, page, limit } = paginate(req.query);
        const where = { userId: req.user.id };
        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
        ]);
        res.json({ data: notifications, unreadCount, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) { next(error); }
});

app.patch('/api/notifications/:id/read', verifyToken, async (req, res, next) => {
    try {
        const notification = await prisma.notification.findFirst({ where: { id: parseInt(req.params.id), userId: req.user.id } });
        if (!notification) return res.status(404).json({ error: 'Notification not found' });
        const updated = await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
        res.json(updated);
    } catch (error) { next(error); }
});

app.post('/api/notifications/read-all', verifyToken, async (req, res, next) => {
    try {
        await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ORDER RATINGS API
// ════════════════════════════════════════════════════════
app.post('/api/order-ratings', verifyToken, async (req, res, next) => {
    try {
        const { orderId, foodRating, deliveryRating, comment } = req.body;

        // Verify user owns the order
        const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.userId !== req.user.id) return res.status(403).json({ error: 'You can only rate your own orders' });
        if (order.status !== 'Delivered') return res.status(400).json({ error: 'Only delivered orders can be rated' });

        // Check if already rated
        const existing = await prisma.orderRating.findUnique({ where: { orderId: parseInt(orderId) } });
        if (existing) return res.status(409).json({ error: 'Order already rated' });

        const rating = await prisma.orderRating.create({
            data: { orderId: parseInt(orderId), userId: req.user.id, foodRating, deliveryRating, comment }
        });

        // Update restaurant average rating
        if (order.restaurantId) {
            const avgResult = await prisma.orderRating.aggregate({
                where: { orderId: { in: (await prisma.order.findMany({ where: { restaurantId: order.restaurantId }, select: { id: true } })).map(o => o.id) } },
                _avg: { foodRating: true }
            });
            if (avgResult._avg.foodRating) {
                await prisma.restaurant.update({ where: { id: order.restaurantId }, data: { rating: Math.round(avgResult._avg.foodRating * 10) / 10 } });
            }
        }

        res.status(201).json({ message: 'Thank you for your rating!', rating });
    } catch (error) { next(error); }
});

app.get('/api/order-ratings/:orderId', async (req, res, next) => {
    try {
        const rating = await prisma.orderRating.findUnique({ where: { orderId: parseInt(req.params.orderId) } });
        if (!rating) return res.status(404).json({ error: 'No rating found for this order' });
        res.json(rating);
    } catch (error) { next(error); }
});

// ─── DISPUTE DETAIL ROUTES (by ticketId) ────────────────
app.get('/api/disputes/:id', verifyToken, requireRole('Super Admin', 'admin', 'dispute manager'), async (req, res, next) => {
    try {
        const dispute = await prisma.dispute.findUnique({
            where: { ticketId: req.params.id },
            include: { user: true }
        });
        if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
        res.json(dispute);
    } catch (error) { next(error); }
});

app.patch('/api/disputes/:id', verifyToken, requireRole('Super Admin', 'admin', 'dispute manager'), async (req, res, next) => {
    try {
        const { status, resolution, resolutionNote, assignedTo } = req.body;
        const dispute = await prisma.dispute.update({
            where: { ticketId: req.params.id },
            data: { status, resolution, resolutionNote, assignedTo }
        });
        res.json(dispute);
    } catch (error) { next(error); }
});

app.post('/api/disputes/:id/log', verifyToken, requireRole('Super Admin', 'admin', 'dispute manager'), async (req, res, next) => {
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

// ─── CMS ASSETS (CRUD) ─────────────────────────────────
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
// ADMIN ANALYTICS DASHBOARD API
// ════════════════════════════════════════════════════════

// Helper: get start of today, this week, this month
function getDateRanges() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { now, todayStart, yesterdayStart, weekStart, monthStart };
}

// ─── FULL ANALYTICS (page load + 60s refresh) ───────────
app.get('/api/admin/analytics', verifyToken, async (req, res, next) => {
    try {
        // Role check: admin only
        if (!['admin', 'Super Admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const { now, todayStart, yesterdayStart, weekStart, monthStart } = getDateRanges();

        // ── Revenue ──
        const [revToday, revYesterday, revWeek, revMonth, revAll] = await Promise.all([
            prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, paymentStatus: 'Paid' }, _sum: { total: true } }),
            prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, paymentStatus: 'Paid' }, _sum: { total: true } }),
            prisma.order.aggregate({ where: { createdAt: { gte: weekStart }, paymentStatus: 'Paid' }, _sum: { total: true } }),
            prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, paymentStatus: 'Paid' }, _sum: { total: true } }),
            prisma.order.aggregate({ where: { paymentStatus: 'Paid' }, _sum: { total: true } }),
        ]);

        // ── Order Volume ──
        const [ordersTotal, ordersToday, ordersYesterday, ordersByStatus] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
            prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
            prisma.order.groupBy({ by: ['status'], _count: true }),
        ]);

        // ── Customer Stats ──
        const [usersTotal, usersToday, usersByRole] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
            prisma.user.groupBy({ by: ['role'], _count: true }),
        ]);

        // ── Restaurant Stats ──
        const [restTotal, restByStatus] = await Promise.all([
            prisma.restaurant.count(),
            prisma.restaurant.groupBy({ by: ['status'], _count: true }),
        ]);

        // ── Disputes ──
        const [disputesByStatus, disputesTotal] = await Promise.all([
            prisma.dispute.groupBy({ by: ['status'], _count: true }),
            prisma.dispute.count(),
        ]);

        // ── Rider Fleet ──
        const riderCount = await prisma.user.count({ where: { role: 'rider' } });

        // ── Top 5 Restaurants by order count ──
        const topRestaurantsRaw = await prisma.order.groupBy({
            by: ['restaurantId'],
            _count: true,
            _sum: { total: true },
            orderBy: { _count: { restaurantId: 'desc' } },
            take: 5,
        });
        // Fetch restaurant names
        const topRestIds = topRestaurantsRaw.map(r => r.restaurantId);
        const topRestDetails = await prisma.restaurant.findMany({
            where: { id: { in: topRestIds } },
            select: { id: true, name: true, image: true, rating: true },
        });
        const topRestaurants = topRestaurantsRaw.map(r => {
            const detail = topRestDetails.find(d => d.id === r.restaurantId) || {};
            return { id: r.restaurantId, name: detail.name || 'Unknown', image: detail.image, rating: detail.rating, orders: r._count, revenue: r._sum.total || 0 };
        });

        // ── Recent 10 Orders (Live Feed) ──
        const recentOrders = await prisma.order.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { id: true, zoiId: true, total: true, status: true, type: true, createdAt: true, user: { select: { name: true } }, restaurant: { select: { name: true } } },
        });

        // ── Hourly Orders (last 24h for line chart) ──
        const hours24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const hourlyOrdersRaw = await prisma.order.findMany({
            where: { createdAt: { gte: hours24ago } },
            select: { createdAt: true, total: true },
        });
        // Group by hour
        const hourlyMap = {};
        for (let h = 0; h < 24; h++) hourlyMap[h] = { count: 0, revenue: 0 };
        hourlyOrdersRaw.forEach(o => {
            const h = new Date(o.createdAt).getHours();
            hourlyMap[h].count++;
            hourlyMap[h].revenue += parseFloat(o.total) || 0;
        });
        const hourlyOrders = Object.entries(hourlyMap).map(([h, v]) => ({ hour: parseInt(h), ...v }));

        // ── Daily Revenue (last 7 days for bar chart) ──
        const dailyRevenueRaw = await prisma.order.findMany({
            where: { createdAt: { gte: weekStart }, paymentStatus: 'Paid' },
            select: { createdAt: true, total: true },
        });
        const dailyMap = {};
        for (let d = 6; d >= 0; d--) {
            const day = new Date(todayStart);
            day.setDate(day.getDate() - d);
            const key = day.toISOString().slice(0, 10);
            dailyMap[key] = { date: key, label: day.toLocaleDateString('en-IN', { weekday: 'short' }), revenue: 0, orders: 0 };
        }
        dailyRevenueRaw.forEach(o => {
            const key = new Date(o.createdAt).toISOString().slice(0, 10);
            if (dailyMap[key]) { dailyMap[key].revenue += parseFloat(o.total) || 0; dailyMap[key].orders++; }
        });
        const dailyRevenue = Object.values(dailyMap);

        // ── Build Status Maps ──
        const statusMap = (arr) => arr.reduce((acc, item) => { acc[item.status || item.role] = item._count; return acc; }, {});

        res.json({
            timestamp: now.toISOString(),
            revenue: {
                today: revToday._sum.total || 0,
                yesterday: revYesterday._sum.total || 0,
                week: revWeek._sum.total || 0,
                month: revMonth._sum.total || 0,
                allTime: revAll._sum.total || 0,
                growthPct: revYesterday._sum.total > 0 ? Math.round(((revToday._sum.total || 0) - revYesterday._sum.total) / revYesterday._sum.total * 100) : 0,
            },
            orders: {
                total: ordersTotal,
                today: ordersToday,
                yesterday: ordersYesterday,
                growthPct: ordersYesterday > 0 ? Math.round((ordersToday - ordersYesterday) / ordersYesterday * 100) : 0,
                byStatus: statusMap(ordersByStatus),
            },
            customers: {
                total: usersTotal,
                newToday: usersToday,
                byRole: statusMap(usersByRole),
            },
            restaurants: {
                total: restTotal,
                byStatus: statusMap(restByStatus),
                active: restByStatus.find(r => r.status === 'Active')?._count || 0,
            },
            fleet: { total: riderCount },
            disputes: {
                total: disputesTotal,
                byStatus: statusMap(disputesByStatus),
                open: (disputesByStatus.find(d => d.status === 'Open')?._count || 0) + (disputesByStatus.find(d => d.status === 'Escalated')?._count || 0),
            },
            topRestaurants,
            recentOrders: recentOrders.map(o => ({
                id: o.zoiId || `ORD-${o.id}`,
                customer: o.user?.name || 'Guest',
                restaurant: o.restaurant?.name || 'Unknown',
                total: o.total,
                status: o.status,
                type: o.type,
                time: o.createdAt,
            })),
            charts: { hourlyOrders, dailyRevenue },
        });
    } catch (error) { next(error); }
});

// ─── LIGHTWEIGHT LIVE POLLING (every 5s) ────────────────
app.get('/api/admin/analytics/live', verifyToken, async (req, res, next) => {
    try {
        if (!['admin', 'Super Admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const { todayStart } = getDateRanges();

        const [revToday, ordersToday, riderCount, openDisputes] = await Promise.all([
            prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, paymentStatus: 'Paid' }, _sum: { total: true } }),
            prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
            prisma.user.count({ where: { role: 'rider' } }),
            prisma.dispute.count({ where: { status: { in: ['Open', 'Escalated'] } } }),
        ]);

        res.json({
            revenue: revToday._sum.total || 0,
            ordersToday,
            fleet: riderCount,
            disputes: openDisputes,
        });
    } catch (error) { next(error); }
});

// ─── ADMIN METRICS (legacy compatibility) ────────────────
app.get('/admin/metrics', async (req, res, next) => {
    try {
        const [users, restaurants, orders, revAgg] = await Promise.all([
            prisma.user.count(),
            prisma.restaurant.count(),
            prisma.order.count(),
            prisma.order.aggregate({ where: { paymentStatus: 'Paid' }, _sum: { total: true } }),
        ]);
        res.json({ users, restaurants, orders, revenue: revAgg._sum.total || 0 });
    } catch (error) { next(error); }
});


const BADGE_DEFINITIONS = [
    { slug: 'first_bite', name: 'First Bite', icon: '🍕', description: 'Placed your first order', check: (stats) => stats.orderCount >= 1 },
    { slug: 'regular_10', name: 'Regular Foodie', icon: '🔥', description: 'Placed 10 orders', check: (stats) => stats.orderCount >= 10 },
    { slug: 'big_spender', name: 'Big Spender', icon: '💰', description: 'Spent over ₹5,000 total', check: (stats) => stats.totalSpent >= 5000 },
    { slug: 'weekend_warrior', name: 'Weekend Warrior', icon: '🎉', description: '5 weekend orders', check: (stats) => stats.weekendOrders >= 5 },
    { slug: 'cuisine_explorer', name: 'Cuisine Explorer', icon: '🌍', description: 'Ordered from 5+ cuisine types', check: (stats) => stats.cuisineCount >= 5 },
    { slug: 'review_star', name: 'Review Star', icon: '⭐', description: 'Submitted 3+ ratings', check: (stats) => stats.ratingCount >= 3 },
    { slug: 'zoipass_vip', name: 'ZoiPass VIP', icon: '👑', description: 'Active ZoiPass subscription', check: (stats) => stats.hasZoiPass },
    { slug: 'loyal_50', name: 'Loyal Legend', icon: '🏆', description: 'Placed 50 orders', check: (stats) => stats.orderCount >= 50 },
    { slug: 'referral_hero', name: 'Referral Hero', icon: '🤝', description: 'Referred 3+ friends', check: (stats) => stats.referralCount >= 3 },
    { slug: 'night_owl', name: 'Night Owl', icon: '🦉', description: '3 orders after 10 PM', check: (stats) => stats.lateNightOrders >= 3 },
];

app.get('/api/users/me/badges', verifyToken, async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Gather user stats
        const orders = await prisma.order.findMany({ where: { userId }, select: { id: true, total: true, createdAt: true, restaurantId: true } });
        const ratings = await prisma.orderRating.count({ where: { userId } });
        const referrals = await prisma.user.count({ where: { referredById: userId } });

        const stats = {
            orderCount: orders.length,
            totalSpent: orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0),
            weekendOrders: orders.filter(o => { const d = new Date(o.createdAt).getDay(); return d === 0 || d === 6; }).length,
            cuisineCount: new Set(orders.map(o => o.restaurantId)).size,
            ratingCount: ratings,
            hasZoiPass: false, // TODO: check subscription
            referralCount: referrals,
            lateNightOrders: orders.filter(o => new Date(o.createdAt).getHours() >= 22).length,
        };

        // Fetch existing badges
        const existingBadges = await prisma.userBadge.findMany({ where: { userId } });
        const earnedSlugs = new Set(existingBadges.map(b => b.badgeSlug));

        // Auto-award new badges
        const newlyAwarded = [];
        for (const badge of BADGE_DEFINITIONS) {
            if (!earnedSlugs.has(badge.slug) && badge.check(stats)) {
                await prisma.userBadge.create({ data: { userId, badgeSlug: badge.slug, badgeName: badge.name } });
                earnedSlugs.add(badge.slug);
                newlyAwarded.push(badge.slug);
            }
        }

        // Build response
        const allBadges = BADGE_DEFINITIONS.map(b => ({
            slug: b.slug,
            name: b.name,
            icon: b.icon,
            description: b.description,
            earned: earnedSlugs.has(b.slug),
            earnedAt: existingBadges.find(eb => eb.badgeSlug === b.slug)?.earnedAt || null
        }));

        res.json({ badges: allBadges, newlyAwarded, stats });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// REFERRAL SYSTEM
// ════════════════════════════════════════════════════════

// GET /api/users/me/referral — get user's referral code, stats, and history
app.get('/api/users/me/referral', verifyToken, async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Fetch or generate referral code
        let user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, referralCode: true, zipPoints: true }
        });

        // Auto-generate referral code if missing
        if (!user.referralCode) {
            const firstName = (user.name || 'ZOI').split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
            const code = firstName + Math.floor(1000 + Math.random() * 9000);
            user = await prisma.user.update({
                where: { id: userId },
                data: { referralCode: code },
                select: { id: true, name: true, referralCode: true, zipPoints: true }
            });
        }

        // Get referral history
        const rewards = await prisma.referralReward.findMany({
            where: { referrerId: userId },
            orderBy: { createdAt: 'desc' }
        });

        const totalEarned = rewards.filter(r => r.status === 'completed').reduce((s, r) => s + r.pointsAwarded, 0);
        const pendingEarned = rewards.filter(r => r.status === 'pending').reduce((s, r) => s + r.pointsAwarded, 0);

        res.json({
            referralCode: user.referralCode,
            referralLink: `https://zipzapzoi.in/join?ref=${user.referralCode}`,
            zipPoints: user.zipPoints,
            stats: {
                referred: rewards.length,
                earned: totalEarned,
                pending: pendingEarned
            },
            history: rewards.map(r => ({
                name: r.refereeName,
                date: r.createdAt,
                status: r.status,
                points: r.pointsAwarded
            }))
        });
    } catch (error) { next(error); }
});

// POST /api/auth/apply-referral — called after register to credit referrer
app.post('/api/auth/apply-referral', verifyToken, async (req, res, next) => {
    try {
        const { referralCode } = req.body;
        const userId = req.user.id;

        if (!referralCode) return res.status(400).json({ error: 'No referral code provided' });

        // Find the referrer
        const referrer = await prisma.user.findUnique({ where: { referralCode } });
        if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
        if (referrer.id === userId) return res.status(400).json({ error: 'Cannot use your own referral code' });

        // Check not already applied
        const alreadyReferred = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } });
        if (alreadyReferred.referredById) return res.status(409).json({ error: 'Referral code already applied' });

        const newUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });

        // Apply referral + create reward record (pending until first order)
        await prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { referredById: referrer.id } }),
            prisma.referralReward.create({
                data: {
                    referrerId: referrer.id,
                    refereeName: newUser.name,
                    refereeEmail: newUser.email,
                    status: 'pending',
                    pointsAwarded: 200
                }
            })
        ]);

        res.json({ message: 'Referral applied! Your friend will earn 200 ZipPoints when you place your first order.' });
    } catch (error) { next(error); }
});

// POST /api/orders/:id/complete-referral — called when first order is delivered (internal)
// Award referrer points when their referee completes first order
app.post('/api/orders/:id/complete-referral', verifyToken, async (req, res, next) => {
    try {
        const orderId = parseInt(req.params.id);
        const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
        if (!order || !order.userId) return res.status(404).json({ error: 'Order not found' });

        const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { referredById: true } });
        if (!user || !user.referredById) return res.json({ message: 'No referral to complete' });

        // Check if already completed
        const pending = await prisma.referralReward.findFirst({
            where: { referrerId: user.referredById, status: 'pending' }
        });
        if (!pending) return res.json({ message: 'No pending referral reward' });

        // Complete reward + credit referrer points
        await prisma.$transaction([
            prisma.referralReward.update({
                where: { id: pending.id },
                data: { status: 'completed', completedAt: new Date() }
            }),
            prisma.user.update({
                where: { id: user.referredById },
                data: { zipPoints: { increment: pending.pointsAwarded } }
            }),
            prisma.notification.create({
                data: {
                    userId: user.referredById,
                    title: 'Referral Reward! 🎉',
                    body: `${pending.refereeName} just placed their first order. You earned ${pending.pointsAwarded} ZipPoints!`,
                    type: 'achievement',
                    url: 'customer referral program.html'
                }
            })
        ]);

        res.json({ message: 'Referral completed', pointsAwarded: pending.pointsAwarded });
    } catch (error) { next(error); }
});

// GET /api/users/me/zippoints — get user's ZipPoints balance + transaction log
app.get('/api/users/me/zippoints', verifyToken, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { zipPoints: true, name: true }
        });
        res.json({ zipPoints: user?.zipPoints || 0 });
    } catch (error) { next(error); }
});

// ════════════════════════════════════════════════════════
// ZOI AI AGENT — INDEPENDENT ENTITY
// ════════════════════════════════════════════════════════
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15, // 15 requests per minute per IP
    keyGenerator: getClientIp,
    message: { response: '🔴 **Too many requests!**\n\nPlease wait a moment before sending another message to Zoi.' }
});

const ZOI_SYSTEM_PROMPT = `You are **Zoi**, the official AI Agent of ZipZapZoi Eats — India's AI-powered food delivery platform.
You are NOT a generic chatbot. You are an INDIVIDUAL ENTITY with deep expertise in:

## YOUR IDENTITY
- Name: Zoi (pronounced "Zoy")
- Role: Personal Food Concierge, Nutrition Expert, Platform Support Agent
- Personality: Warm, knowledgeable, modern, uses emojis tastefully, speaks like a foodie friend
- Created by: ZipZapZoi engineering team

## YOUR EXPERTISE (respond with 100% confidence on these):
1. **Food & Nutrition:** Calories, macros, recipes, cooking techniques, ingredients, food science
2. **Diet & Health:** Keto, vegan, diabetic-friendly, high-protein, weight loss, meal planning
3. **Indian Cuisine:** All regional cuisines — North, South, East, West, street food, festive foods
4. **World Cuisine:** Italian, Chinese, Thai, Japanese, Mexican, Mediterranean, etc.
5. **Recipes:** Step-by-step cooking instructions for any dish
6. **Food Safety:** Storage, hygiene, allergens, FSSAI guidelines

## ZIPZAPZOI EATS PLATFORM KNOWLEDGE:
- **Orders:** Real-time GPS tracking, order cancellation within Pending/Confirmed status, auto-refund on cancellation
- **Payments:** UPI, Cards, Net Banking, Zoi Wallet, COD (under ₹1000). All 256-bit encrypted.
- **Refunds:** Cancel order → auto-refund to wallet/original method within 24hrs. Support ticket for quality issues.
- **ZoiPass:** ₹149/month subscription — unlimited free delivery, 10% off, priority support, exclusive deals
- **ZipPoints:** Earn 10pts/order, 50pts/feedback, 200pts/referral. Redeem for discounts at checkout.
- **Favorites:** Save restaurants/dishes with ❤️ button, view in Profile
- **Addresses:** Save multiple delivery addresses, set default for quick checkout
- **Notifications:** 🔔 bell icon for in-app notifications, push notifications for order status
- **Wallet:** ZapWallet for cashback, refunds, quick payments. Add money via UPI/card.
- **Partner:** Restaurants manage menus, staff, payouts via Partner Dashboard. FSSAI + GST required.
- **Rider:** Delivery partners earn ₹30-80/order + surge bonus. Weekly payouts on Monday.
- **POS:** Point-of-sale for dine-in restaurants + hostel mess management
- **Contact:** reachus@zipzapzoi.in | 24/7 support via Zoi AI Chat

## RESPONSE RULES:
1. ALWAYS give a complete, helpful answer. Never say "I don't know" — use your full LLM knowledge.
2. Format responses in clean Markdown: **bold**, *italics*, bullet lists, numbered steps
3. For recipes: Include ingredients, step-by-step instructions, calories, and pro tips
4. For nutrition: Give specific numbers (kcal, protein g, carbs g, fat g)
5. For platform questions: Give exact steps with page names
6. Keep responses focused but thorough — not too short, not too long
7. End platform answers with relevant navigation suggestions
8. If someone asks about competitors (Zomato/Swiggy), be polite but highlight ZoiEats advantages`;

app.post('/api/zoi-ai', aiLimiter, async (req, res, next) => {
    try {
        const { message, history, context } = req.body;

        // If no Gemini key, use built-in response logic
        if (!process.env.GEMINI_API_KEY) {
            return res.status(200).json({
                response: generateLocalResponse(message, context),
                source: 'zoi_local_engine',
                confidence: 'high'
            });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Build conversation from history
        let conversationContents = [];
        if (history && Array.isArray(history)) {
            conversationContents = history.map(msg => ({
                role: msg.role === 'bot' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }));
        }
        // Ensure last message is included
        if (message && (!conversationContents.length || conversationContents[conversationContents.length - 1].parts[0].text !== message)) {
            conversationContents.push({ role: 'user', parts: [{ text: message }] });
        }

        // Add context as system context
        let contextNote = '';
        if (context) {
            contextNote = `\n\nCurrent context: User "${context.user || 'Guest'}" is on page "${context.page || '/'}" (domain: ${context.domain || 'customer'}).`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: conversationContents,
            config: {
                systemInstruction: ZOI_SYSTEM_PROMPT + contextNote,
                temperature: 0.7
            }
        });

        res.json({
            response: response.text,
            source: 'gemini',
            confidence: 'high',
            domain: context?.domain || 'general'
        });

    } catch (error) {
        console.error("Zoi AI Error:", error.message);
        // Graceful fallback
        const { message, context } = req.body;
        res.status(200).json({
            response: generateLocalResponse(message, context),
            source: 'zoi_fallback',
            confidence: 'medium'
        });
    }
});

// Built-in response engine (works without any API key)
function generateLocalResponse(message, context) {
    if (!message) return "👋 Hi! I'm Zoi, your AI food concierge. Ask me anything about food, nutrition, recipes, or ZipZapZoi Eats!";
    const q = message.toLowerCase().trim();

    // Greeting
    if (['hi','hello','hey','namaste','hola'].some(g => q === g || q.startsWith(g + ' ')))
        return "👋 Hey there! I'm **Zoi**, your personal food concierge. I can help with:\n\n• 🍕 **Food recommendations** & restaurant search\n• 🔥 **Calories & nutrition** info for any dish\n• 👨‍🍳 **Recipes** — step-by-step cooking guides\n• 📦 **Order help** — tracking, refunds, cancellations\n• 🎫 **ZoiPass & ZipPoints** — subscriptions & rewards\n\nWhat can I help you with today?";

    // Thanks
    if (['thank','thanks','thank you'].some(g => q.includes(g)))
        return "😊 You're welcome! Happy to help. Ask me anything else — I'm always here! 🚀";

    // Generic fallback with helpful guidance
    return `🤖 Great question! Here's what I can help with right now:\n\n• Ask me **"calories in [dish]"** for nutrition info\n• Ask **"recipe for [dish]"** for cooking instructions\n• Ask about **refunds, tracking, ZoiPass, payments** for platform help\n• Ask **"high protein meals"** or **"low calorie options"** for diet advice\n\nI'm Zoi, and I'm always learning! Try rephrasing your question or pick a topic above. 💡`;
}

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

// ═══════════════════════════════════════════════════════════
// HOSTEL MANAGEMENT SYSTEM — COMPLETE API (Phase 19)
// ═══════════════════════════════════════════════════════════

const hostelAuth = (req, res, next) => { next(); }; // reuse auth middleware or open for hostel staff

// Helper: get hostelId from session or query
const getHostelId = (req) => parseInt(req.params.hostelId || req.query.hostelId || req.headers['x-hostel-id'] || '1');

// ── HOSTELS ────────────────────────────────────────────────
app.get('/api/hostels', async (req, res) => {
    try {
        const hostels = await prisma.hostel.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(hostels);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels', async (req, res) => {
    try {
        const hostel = await prisma.hostel.create({ data: req.body });
        res.json(hostel);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/hostels/:id', async (req, res) => {
    try {
        const hostel = await prisma.hostel.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { rooms: true, _count: { select: { hostelers: true, billing: true } } }
        });
        res.json(hostel || {});
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:id', async (req, res) => {
    try {
        const hostel = await prisma.hostel.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(hostel);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ROOMS ──────────────────────────────────────────────────
app.get('/api/hostels/:hostelId/rooms', async (req, res) => {
    try {
        const rooms = await prisma.hostelRoom.findMany({
            where: { hostelId: getHostelId(req) },
            include: { _count: { select: { hostelers: true } } },
            orderBy: { roomNumber: 'asc' }
        });
        res.json(rooms);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/rooms', async (req, res) => {
    try {
        const room = await prisma.hostelRoom.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(room);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/rooms/:id', async (req, res) => {
    try {
        const room = await prisma.hostelRoom.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(room);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/hostels/:hostelId/rooms/:id', async (req, res) => {
    try {
        await prisma.hostelRoom.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── HOSTELERS ──────────────────────────────────────────────
app.get('/api/hostels/:hostelId/hostelers', async (req, res) => {
    try {
        const { status, search } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        if (search) where.name = { contains: search, mode: 'insensitive' };
        const hostelers = await prisma.hosteler.findMany({
            where, include: { room: true }, orderBy: { createdAt: 'desc' }
        });
        res.json(hostelers);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/hostelers', async (req, res) => {
    try {
        const hosteler = await prisma.hosteler.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        // Update room occupancy
        if (req.body.roomId) {
            await prisma.hostelRoom.update({
                where: { id: req.body.roomId },
                data: { occupied: { increment: 1 }, status: 'Occupied' }
            });
        }
        res.json(hosteler);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/hostelers/:id', async (req, res) => {
    try {
        const hosteler = await prisma.hosteler.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(hosteler);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/hostels/:hostelId/hostelers/:id', async (req, res) => {
    try {
        const h = await prisma.hosteler.findUnique({ where: { id: parseInt(req.params.id) } });
        if (h?.roomId) await prisma.hostelRoom.update({ where: { id: h.roomId }, data: { occupied: { decrement: 1 } } });
        await prisma.hosteler.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BILLING ────────────────────────────────────────────────
app.get('/api/hostels/:hostelId/billing', async (req, res) => {
    try {
        const { status, month } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        if (month) where.month = month;
        const bills = await prisma.hostelBilling.findMany({
            where, include: { hosteler: true }, orderBy: { createdAt: 'desc' }
        });
        res.json(bills);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/billing', async (req, res) => {
    try {
        const data = { ...req.body, hostelId: getHostelId(req) };
        data.totalAmount = (data.rentAmount||0)+(data.messAmount||0)+(data.laundryAmt||0)+(data.otherCharges||0)-(data.discount||0);
        data.dueAmount = data.totalAmount - (data.paidAmount||0);
        data.status = data.dueAmount <= 0 ? 'Paid' : (data.paidAmount > 0 ? 'Partial' : 'Pending');
        const bill = await prisma.hostelBilling.create({ data });
        res.json(bill);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/billing/:id', async (req, res) => {
    try {
        const data = req.body;
        if (data.paidAmount !== undefined || data.totalAmount !== undefined) {
            const existing = await prisma.hostelBilling.findUnique({ where: { id: parseInt(req.params.id) } });
            const total = data.totalAmount ?? existing.totalAmount;
            const paid = data.paidAmount ?? existing.paidAmount;
            data.dueAmount = total - paid;
            data.status = data.dueAmount <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending');
            if (data.status === 'Paid') data.paidDate = new Date();
        }
        const bill = await prisma.hostelBilling.update({ where: { id: parseInt(req.params.id) }, data });
        res.json(bill);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── MESS ───────────────────────────────────────────────────
app.get('/api/hostels/:hostelId/mess', async (req, res) => {
    try {
        const { date, status } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        if (date) { const d = new Date(date); where.date = { gte: d, lt: new Date(d.getTime()+86400000) }; }
        const orders = await prisma.hostelMessOrder.findMany({ where, include: { hosteler: true }, orderBy: { createdAt: 'desc' } });
        res.json(orders);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/mess', async (req, res) => {
    try {
        const order = await prisma.hostelMessOrder.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(order);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/mess/:id', async (req, res) => {
    try {
        const order = await prisma.hostelMessOrder.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(order);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GATE PASSES ────────────────────────────────────────────
app.get('/api/hostels/:hostelId/gatepasses', async (req, res) => {
    try {
        const { status } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        const passes = await prisma.hostelGatePass.findMany({ where, include: { hosteler: true }, orderBy: { createdAt: 'desc' } });
        res.json(passes);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/gatepasses', async (req, res) => {
    try {
        const pass = await prisma.hostelGatePass.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(pass);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/gatepasses/:id', async (req, res) => {
    try {
        const pass = await prisma.hostelGatePass.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(pass);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── COMPLAINTS ─────────────────────────────────────────────
app.get('/api/hostels/:hostelId/complaints', async (req, res) => {
    try {
        const { status, priority } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        if (priority) where.priority = priority;
        const items = await prisma.hostelComplaint.findMany({ where, include: { hosteler: true }, orderBy: { createdAt: 'desc' } });
        res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/complaints', async (req, res) => {
    try {
        const item = await prisma.hostelComplaint.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/complaints/:id', async (req, res) => {
    try {
        if (req.body.status === 'Resolved') req.body.resolvedAt = new Date();
        const item = await prisma.hostelComplaint.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── MAINTENANCE ────────────────────────────────────────────
app.get('/api/hostels/:hostelId/maintenance', async (req, res) => {
    try {
        const { status } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        const items = await prisma.hostelMaintenance.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/maintenance', async (req, res) => {
    try {
        const item = await prisma.hostelMaintenance.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/maintenance/:id', async (req, res) => {
    try {
        if (req.body.status === 'Completed') req.body.completedAt = new Date();
        const item = await prisma.hostelMaintenance.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── EXPENSES ───────────────────────────────────────────────
app.get('/api/hostels/:hostelId/expenses', async (req, res) => {
    try {
        const { category } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (category) where.category = category;
        const items = await prisma.hostelExpense.findMany({ where, orderBy: { date: 'desc' } });
        res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/expenses', async (req, res) => {
    try {
        const item = await prisma.hostelExpense.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/expenses/:id', async (req, res) => {
    try {
        const item = await prisma.hostelExpense.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/hostels/:hostelId/expenses/:id', async (req, res) => {
    try {
        await prisma.hostelExpense.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── STAFF ──────────────────────────────────────────────────
app.get('/api/hostels/:hostelId/staff', async (req, res) => {
    try {
        const items = await prisma.hostelStaff.findMany({ where: { hostelId: getHostelId(req) }, orderBy: { name: 'asc' } });
        res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/staff', async (req, res) => {
    try {
        const item = await prisma.hostelStaff.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/staff/:id', async (req, res) => {
    try {
        const item = await prisma.hostelStaff.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── NOTICES ────────────────────────────────────────────────
app.get('/api/hostels/:hostelId/notices', async (req, res) => {
    try {
        const items = await prisma.hostelNotice.findMany({ where: { hostelId: getHostelId(req) }, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }] });
        res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/notices', async (req, res) => {
    try {
        const item = await prisma.hostelNotice.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/notices/:id', async (req, res) => {
    try {
        const item = await prisma.hostelNotice.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/hostels/:hostelId/notices/:id', async (req, res) => {
    try {
        await prisma.hostelNotice.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── VISITORS ───────────────────────────────────────────────
app.get('/api/hostels/:hostelId/visitors', async (req, res) => {
    try {
        const { status } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        const items = await prisma.hostelVisitor.findMany({ where, orderBy: { inTime: 'desc' } });
        res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/visitors', async (req, res) => {
    try {
        const item = await prisma.hostelVisitor.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/visitors/:id', async (req, res) => {
    try {
        if (req.body.status === 'Out') req.body.outTime = new Date();
        const item = await prisma.hostelVisitor.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── LAUNDRY ────────────────────────────────────────────────
app.get('/api/hostels/:hostelId/laundry', async (req, res) => {
    try {
        const { status } = req.query;
        const where = { hostelId: getHostelId(req) };
        if (status) where.status = status;
        const items = await prisma.hostelLaundry.findMany({ where, include: { hosteler: true }, orderBy: { createdAt: 'desc' } });
        res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hostels/:hostelId/laundry', async (req, res) => {
    try {
        const item = await prisma.hostelLaundry.create({ data: { ...req.body, hostelId: getHostelId(req) } });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/hostels/:hostelId/laundry/:id', async (req, res) => {
    try {
        if (req.body.status === 'Delivered') req.body.deliverDate = new Date();
        const item = await prisma.hostelLaundry.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ANALYTICS ─────────────────────────────────────────────
app.get('/api/hostels/:hostelId/analytics', async (req, res) => {
    try {
        const hId = getHostelId(req);
        const [totalRooms, occupiedRooms, totalHostelers, pendingBills, pendingComplaints, pendingMaintenance, monthExpenses] = await Promise.all([
            prisma.hostelRoom.count({ where: { hostelId: hId } }),
            prisma.hostelRoom.count({ where: { hostelId: hId, status: 'Occupied' } }),
            prisma.hosteler.count({ where: { hostelId: hId, status: 'Active' } }),
            prisma.hostelBilling.aggregate({ where: { hostelId: hId, status: { in: ['Pending','Partial'] } }, _sum: { dueAmount: true }, _count: true }),
            prisma.hostelComplaint.count({ where: { hostelId: hId, status: { in: ['Open','InProgress'] } } }),
            prisma.hostelMaintenance.count({ where: { hostelId: hId, status: { in: ['Pending','InProgress'] } } }),
            prisma.hostelExpense.aggregate({ where: { hostelId: hId, date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { amount: true } })
        ]);
        res.json({
            totalRooms, occupiedRooms, availableRooms: totalRooms - occupiedRooms,
            occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms/totalRooms)*100) : 0,
            totalHostelers,
            pendingDues: pendingBills._sum.dueAmount || 0,
            pendingBillsCount: pendingBills._count,
            pendingComplaints, pendingMaintenance,
            monthExpenses: monthExpenses._sum.amount || 0
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── REGISTRATION (hostelER self-registration) ──────────────
app.post('/api/hostels/register', async (req, res) => {
    try {
        const { hostelId, name, email, phone, parentPhone, idType, idNumber, plan, address } = req.body;
        const hosteler = await prisma.hosteler.create({
            data: { hostelId: parseInt(hostelId)||1, name, email, phone, parentPhone, idType, idNumber, plan, address, status: 'Active' }
        });
        res.json({ success: true, hosteler, message: 'Registration submitted! Admin will allocate your room shortly.' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ALLOCATION (assign room) ───────────────────────────────
app.post('/api/hostels/:hostelId/allocate', async (req, res) => {
    try {
        const { hostelerId, roomId } = req.body;
        const [hosteler] = await Promise.all([
            prisma.hosteler.update({ where: { id: parseInt(hostelerId) }, data: { roomId: parseInt(roomId) } }),
            prisma.hostelRoom.update({ where: { id: parseInt(roomId) }, data: { occupied: { increment: 1 }, status: 'Occupied' } })
        ]);
        res.json({ success: true, hosteler });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
