const nodemailer = require('nodemailer');
const webpush = require('web-push');

class NotificationService {
    constructor() {
        this.transporter = null;
        this.mode = 'initializing';
        this.init();
    }

    async init() {
        try {
            // ═══ PRODUCTION MODE: Real SMTP provider ═══
            if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587'),
                    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });

                // Verify connection
                await this.transporter.verify();
                this.mode = 'production';
                console.log("📧 Production SMTP connected:", process.env.SMTP_HOST);
                return;
            }

            // ═══ DEVELOPMENT MODE: Ethereal test account ═══
            let testAccount = await nodemailer.createTestAccount();
            this.transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            this.mode = 'development';
            console.log("📧 Ethereal Email Ready: Emails will be logged with preview URLs.");

        } catch (err) {
            console.error("📧 Email service initialization failed:", err.message);
            this.mode = 'disabled';
        }
    }

    /**
     * Get the "from" address
     */
    getFromAddress() {
        return process.env.SMTP_FROM || '"ZipZapZoi Eats" <noreply@zipzapzoi.in>';
    }

    /**
     * Wrap content in branded HTML template
     */
    brandedTemplate(title, bodyContent) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0314;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0314;">
        <tr><td style="padding:40px 20px;">
            <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a0b36,#0a0314);border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
                <!-- Header -->
                <tr><td style="padding:32px 40px 16px;text-align:center;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;">
                        <span style="color:#ffffff;">ZipZap</span><span style="color:#00f0ff;">Zoi</span>
                        <span style="color:#ff2a6d;">⚡</span>
                        <span style="color:#rgba(255,255,255,0.6);font-size:16px;font-weight:400;"> Eats</span>
                    </div>
                </td></tr>
                <!-- Content -->
                <tr><td style="padding:16px 40px 40px;color:#e2e8f0;font-size:15px;line-height:1.7;">
                    ${bodyContent}
                </td></tr>
                <!-- Footer -->
                <tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">
                        © ${new Date().getFullYear()} ZipZapZoi Eats · All rights reserved<br>
                        <a href="https://zipzapzoi.in" style="color:#00f0ff;text-decoration:none;">zipzapzoi.in</a>
                    </p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;
    }

    // ═══════════════════════════════════════════════════════
    // EMAIL METHODS
    // ═══════════════════════════════════════════════════════

    /**
     * Send order confirmation notification
     */
    async sendOrderConfirmation(user, order) {
        if (!user || (!user.email && !user.phone)) {
            console.log("No contact info provided for user, skipping notification.");
            return;
        }

        const subject = `✅ Order Confirmed: ${order.zoiId}`;
        const text = `Hi ${user.name},\n\nYour ZoiEats order ${order.zoiId} has been confirmed. Total: ₹${order.total}.\n\nThank you for choosing ZipZapZoi!`;
        const html = this.brandedTemplate(`Order Confirmed: ${order.zoiId}`, `
            <h2 style="color:#00f0ff;margin:0 0 16px;">Order Confirmed! 🎉</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Your ZoiEats order <strong style="color:#00f0ff;">${order.zoiId}</strong> has been confirmed.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:rgba(0,240,255,0.05);border-radius:16px;border:1px solid rgba(0,240,255,0.1);">
                <tr><td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.6);">Total Amount</p>
                    <p style="margin:0;font-size:28px;font-weight:800;color:#00f0ff;">₹${order.total}</p>
                </td></tr>
            </table>
            <p>Track your order live on the ZipZapZoi Eats app.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="https://zipzapzoi.in/customer%20order_tracking.html" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00f0ff,#7c3aed);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Track Order →</a>
            </div>
            <p style="color:rgba(255,255,255,0.5);">Thank you for choosing ZipZapZoi!</p>
        `);

        if (user.email) this.sendEmail(user.email, subject, text, html);
        if (user.phone) this.sendSMS(user.phone, `ZoiEats: Order ${order.zoiId} confirmed! Total: ₹${order.total}`);
    }

    /**
     * Send order status update notification
     */
    async sendOrderStatusUpdate(user, order) {
        if (!user || (!user.email && !user.phone)) return;

        const statusEmojis = {
            'Preparing': '👨‍🍳', 'Ready': '✅', 'Picked Up': '🏍️',
            'On the Way': '🚀', 'Delivered': '🎉', 'Cancelled': '❌'
        };
        const emoji = statusEmojis[order.status] || '📦';

        const subject = `${emoji} Order Update: ${order.zoiId} — ${order.status}`;
        const text = `Hi ${user.name},\n\nYour order ${order.zoiId} status: ${order.status}.\nTrack it live!`;
        const html = this.brandedTemplate(`Order Update: ${order.zoiId}`, `
            <h2 style="color:#00f0ff;margin:0 0 16px;">Order Update ${emoji}</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Your order <strong style="color:#00f0ff;">${order.zoiId}</strong> status is now:</p>
            <div style="text-align:center;margin:24px 0;padding:20px;background:rgba(0,240,255,0.05);border-radius:16px;border:1px solid rgba(0,240,255,0.1);">
                <span style="font-size:32px;font-weight:800;color:#00f0ff;">${order.status}</span>
            </div>
        `);

        if (user.email) this.sendEmail(user.email, subject, text, html);
        if (user.phone) this.sendSMS(user.phone, `ZoiEats: Order ${order.zoiId} is now ${order.status}`);
    }

    /**
     * Send welcome email to new users
     */
    async sendWelcomeEmail(user) {
        if (!user || !user.email) return;

        const subject = '🎉 Welcome to ZipZapZoi Eats!';
        const text = `Hi ${user.name},\n\nWelcome to ZipZapZoi Eats! Discover amazing restaurants, order delicious food, and enjoy doorstep delivery.`;
        const html = this.brandedTemplate('Welcome to ZipZapZoi Eats', `
            <h2 style="color:#00f0ff;margin:0 0 16px;">Welcome Aboard! 🚀</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>We're thrilled to have you on <strong style="color:#00f0ff;">ZipZapZoi Eats</strong>! Here's what you can do:</p>
            <ul style="padding-left:20px;color:#e2e8f0;">
                <li style="margin:8px 0;">🍕 Browse 500+ restaurants near you</li>
                <li style="margin:8px 0;">⚡ Lightning-fast delivery</li>
                <li style="margin:8px 0;">🎁 Exclusive offers & rewards</li>
                <li style="margin:8px 0;">🤖 Ask Zoi AI for food recommendations</li>
            </ul>
            <div style="text-align:center;margin:28px 0;">
                <a href="https://zipzapzoi.in" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#00f0ff,#7c3aed);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">Start Ordering →</a>
            </div>
            <p style="color:rgba(255,255,255,0.5);">Your ZoiEats journey begins now!</p>
        `);

        this.sendEmail(user.email, subject, text, html);
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(user, resetToken) {
        if (!user || !user.email) return;

        const resetUrl = `https://zipzapzoi.in/reset-password.html?token=${resetToken}`;
        const subject = '🔑 Password Reset — ZipZapZoi Eats';
        const text = `Hi ${user.name},\n\nReset your password here: ${resetUrl}\n\nThis link expires in 1 hour.`;
        const html = this.brandedTemplate('Password Reset', `
            <h2 style="color:#00f0ff;margin:0 0 16px;">Password Reset 🔑</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to set a new one:</p>
            <div style="text-align:center;margin:28px 0;">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#00f0ff,#7c3aed);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">Reset Password →</a>
            </div>
            <p style="color:rgba(255,255,255,0.5);">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</p>
        `);

        this.sendEmail(user.email, subject, text, html);
    }

    /**
     * Core email send method
     */
    async sendEmail(to, subject, text, html) {
        if (!this.transporter || this.mode === 'disabled') {
            console.log(`📧 [SKIPPED] Email to ${to}: ${subject}`);
            return;
        }
        try {
            const info = await this.transporter.sendMail({
                from: this.getFromAddress(),
                to, subject, text, html
            });
            console.log(`✉️ Email Sent to ${to} (${this.mode})`);
            if (this.mode === 'development') {
                console.log(`🔍 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            }
            return info;
        } catch (err) {
            console.error("Email send error:", err.message);
        }
    }

    /**
     * SMS placeholder (integrate Twilio/MSG91 when ready)
     */
    sendSMS(to, message) {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            // Future: real Twilio integration
            console.log(`📱 [TWILIO] SMS to ${to}: "${message}"`);
        } else {
            console.log(`📱 [DEV] SMS to ${to}: "${message}"`);
        }
    }

    /**
     * Send push notification to a specific user
     */
    async sendPushToUser(prisma, userId, payload) {
        try {
            if (!process.env.PUBLIC_VAPID_KEY || !process.env.PRIVATE_VAPID_KEY) return;

            const subs = await prisma.pushSubscription.findMany({
                where: { userId }
            });

            if (subs.length === 0) return;

            const pushPayload = JSON.stringify(payload);
            const results = await Promise.allSettled(
                subs.map(sub =>
                    webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: sub.keys },
                        pushPayload
                    ).catch(async (err) => {
                        // Remove expired subscriptions
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                        }
                        throw err;
                    })
                )
            );

            const sent = results.filter(r => r.status === 'fulfilled').length;
            if (sent > 0) console.log(`🔔 Push sent to ${sent} device(s) for user ${userId}`);
        } catch (err) {
            console.error("Push notification error:", err.message);
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            email: this.mode,
            sms: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'demo',
            push: process.env.PUBLIC_VAPID_KEY ? 'configured' : 'disabled'
        };
    }
}

module.exports = new NotificationService();
