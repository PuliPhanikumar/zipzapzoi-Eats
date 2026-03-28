/**
 * ZipZapZoi Eats — Input Validation Middleware
 */
const { body, param, query, validationResult } = require('express-validator');

/**
 * Check validation results and return 400 if errors found.
 */
function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed',
            details: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
}

// ─── AUTH VALIDATIONS ───────────────────────────────────
const validateLogin = [
    body('identifier').trim().notEmpty().withMessage('Email or ZoiID is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidation
];

const validateRegister = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').optional().trim().isLength({ min: 10, max: 15 }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['Customer', 'customer', 'partner', 'rider']).withMessage('Invalid role'),
    handleValidation
];

const validateOtpSend = [
    body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 10, max: 15 }),
    handleValidation
];

const validateOtpVerify = [
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('otp').trim().notEmpty().withMessage('OTP is required').isLength({ min: 4, max: 6 }),
    handleValidation
];

// ─── ORDER VALIDATIONS ─────────────────────────────────
const validateCreateOrder = [
    body('restaurantId').isInt({ min: 1 }).withMessage('Valid restaurant ID is required'),
    body('items').notEmpty().withMessage('Items are required'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Valid total amount is required'),
    body('deliveryAddress').optional().trim(),
    body('zone').optional().trim(),
    handleValidation
];

const validateUpdateOrderStatus = [
    param('id').isInt({ min: 1 }).withMessage('Valid order ID is required'),
    body('status').isIn(['Pending', 'Confirmed', 'Preparing', 'Ready', 'Dispatched', 'Delivered', 'Cancelled'])
        .withMessage('Invalid status'),
    handleValidation
];

// ─── PAYMENT VALIDATIONS ───────────────────────────────
const validateCreatePayment = [
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('currency').optional().isIn(['INR', 'USD']).withMessage('Invalid currency'),
    handleValidation
];

const validateVerifyPayment = [
    body('razorpay_order_id').notEmpty().withMessage('Order ID required'),
    body('razorpay_payment_id').notEmpty().withMessage('Payment ID required'),
    body('razorpay_signature').notEmpty().withMessage('Signature required'),
    handleValidation
];

// ─── FEEDBACK VALIDATIONS ──────────────────────────────
const validateFeedback = [
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ min: 5, max: 2000 }),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('category').optional().trim(),
    handleValidation
];

// ─── SEARCH VALIDATIONS ────────────────────────────────
const validateSearch = [
    query('q').trim().notEmpty().withMessage('Search query is required').isLength({ min: 1, max: 200 }),
    handleValidation
];

module.exports = {
    handleValidation,
    validateLogin,
    validateRegister,
    validateOtpSend,
    validateOtpVerify,
    validateCreateOrder,
    validateUpdateOrderStatus,
    validateCreatePayment,
    validateVerifyPayment,
    validateFeedback,
    validateSearch
};
