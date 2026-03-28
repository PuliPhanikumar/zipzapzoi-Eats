/**
 * ZipZapZoi Eats — JWT Authentication Middleware
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is not set!');
    process.exit(1);
}

const getSecret = () => process.env.JWT_SECRET || 'zoi_dev_secret_only';

/**
 * Verify JWT token from Authorization header.
 * Sets req.user = { id, role, zoiId, name }
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.split(' ')[1] 
        : null;

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, getSecret());
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        return res.status(403).json({ error: 'Invalid token.' });
    }
}

/**
 * Optional token — sets req.user if token exists, but doesn't block.
 */
function optionalToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (token) {
        try {
            req.user = jwt.verify(token, getSecret());
        } catch (e) {
            // Token invalid, but don't block — continue as anonymous
        }
    }
    next();
}

/**
 * Role-based access control middleware.
 * Usage: requireRole('Super Admin', 'admin')
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        const userRole = (req.user.role || '').toLowerCase();
        const allowed = roles.map(r => r.toLowerCase());
        
        if (!allowed.includes(userRole) && !allowed.includes('all')) {
            return res.status(403).json({ error: 'Insufficient permissions.' });
        }
        next();
    };
}

module.exports = { verifyToken, optionalToken, requireRole, getSecret };
