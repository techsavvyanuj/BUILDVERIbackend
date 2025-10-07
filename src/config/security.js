const rateLimit = require('express-rate-limit');

// Constants
const IP_BLOCK_DURATION = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_FAILED_ATTEMPTS = 5;

// Rate limiter configurations
const rateLimitConfigs = {
    login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 attempts per window per IP
        message: 'Too many login attempts, please try again later',
        standardHeaders: true,
        legacyHeaders: false
    },

    registration: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 registrations per hour per IP
        message: 'Too many registration attempts from this IP, please try again later',
        skipFailedRequests: true,
        standardHeaders: true,
        legacyHeaders: false
    }
};

// Password validation rules
const passwordRules = {
    minLength: 8,
    patterns: {
        hasUpperCase: /[A-Z]/,
        hasLowerCase: /[a-z]/,
        hasNumbers: /\d/,
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/
    },
    messages: {
        minLength: 'Password must be at least 8 characters long',
        hasUpperCase: 'Password must contain at least one uppercase letter',
        hasLowerCase: 'Password must contain at least one lowercase letter',
        hasNumbers: 'Password must contain at least one number',
        hasSpecialChar: 'Password must contain at least one special character'
    }
};

// Security headers configuration
const securityHeadersConfig = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval';"
};

// Create rate limiters using configurations
const rateLimiters = {
    login: rateLimit(rateLimitConfigs.login),
    registration: rateLimit(rateLimitConfigs.registration)
};

module.exports = {
    // Constants
    IP_BLOCK_DURATION,
    MAX_FAILED_ATTEMPTS,
    
    // Configurations
    rateLimitConfigs,
    passwordRules,
    securityHeadersConfig,  
    
    // Pre-configured limiters
    rateLimiters
};