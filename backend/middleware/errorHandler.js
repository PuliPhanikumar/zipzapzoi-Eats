/**
 * ZipZapZoi Eats — Centralized Error Handler
 */

function errorHandler(err, req, res, next) {
    console.error(`[ZOI ERROR] ${req.method} ${req.path}:`, err);

    // Prisma known errors
    if (err.code === 'P2002') {
        return res.status(409).json({
            error: 'A record with that unique value already exists.',
            field: err.meta?.target
        });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Record not found.' });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token.' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired.' });
    }

    // Validation errors
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body.' });
    }

    // Default
    const status = err.statusCode || err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error';

    res.status(status).json({ error: message });
}

module.exports = errorHandler;
