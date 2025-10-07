const { ApiError } = require('../utils/apiError');
const {
    IP_BLOCK_DURATION,
    MAX_FAILED_ATTEMPTS,
    passwordRules,
    securityHeadersConfig,
    rateLimiters
} = require('../config/security');

// Track failed login attempts
const loginAttempts = new Map();

// Track and block suspicious IPs
const trackFailedLogin = (ip, success = false) => {
    if (!loginAttempts.has(ip)) {
        loginAttempts.set(ip, { count: 0, blockedUntil: null });
    }

    const attempt = loginAttempts.get(ip);

    if (success) {
        // Reset on successful login
        loginAttempts.delete(ip);
        return;
    }

    attempt.count++;
    if (attempt.count >= MAX_FAILED_ATTEMPTS) {
        attempt.blockedUntil = Date.now() + IP_BLOCK_DURATION;
    }

    loginAttempts.set(ip, attempt);
};

// Middleware to check for blocked IPs
const checkBlockedIP = (req, res, next) => {
    const ip = req.ip;
    const attempt = loginAttempts.get(ip);

    if (attempt && attempt.blockedUntil && attempt.blockedUntil > Date.now()) {
        const remainingTime = Math.ceil((attempt.blockedUntil - Date.now()) / 1000 / 60);
        throw new ApiError(429, `IP blocked due to too many failed attempts. Try again in ${remainingTime} minutes`);
    }

    next();
};

// Middleware to validate password strength
const passwordStrengthCheck = (req, res, next) => {
    const { password } = req.body;
    const errors = [];

    if (password.length < passwordRules.minLength) {
        errors.push(passwordRules.messages.minLength);
    }

    Object.entries(passwordRules.patterns).forEach(([key, pattern]) => {
        if (!pattern.test(password)) {
            errors.push(passwordRules.messages[key]);
        }
    });

    if (errors.length > 0) {
        throw new ApiError(400, 'Password is too weak', errors);
    }

    next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
    Object.entries(securityHeadersConfig).forEach(([header, value]) => {
        res.setHeader(header, value);
    });
    next();
};

module.exports = {
    // Rate limiters from config
    loginLimiter: rateLimiters.login,
    registrationLimiter: rateLimiters.registration,
    
    // Security middleware
    checkBlockedIP,
    trackFailedLogin,
    passwordStrengthCheck,
    securityHeaders
};