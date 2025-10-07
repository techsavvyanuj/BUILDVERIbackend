/**
 * Central middleware exports
 * All middleware should be exported from here
 */

const express = require('express');
const morgan = require('morgan');
const { cors, helmet, rateLimiter } = require('../config');
const { authMiddleware } = require('./auth.middleware');
const roleAuth = require('./roleAuth.middleware');
const { initializeErrorHandling } = require('./errorHandler');
const {
    loginLimiter,
    registrationLimiter,
    checkBlockedIP,
    trackFailedLogin,
    passwordStrengthCheck,
    securityHeaders
} = require('./security.middleware');

// Core middleware initialization
const initializeMiddleware = (app) => {
    // Basic middleware
    app.use(helmet);
    app.use(morgan('dev'));
    app.use('/api', rateLimiter);
    
    // Security headers for all routes
    app.use(securityHeaders);
    
    // Error handling is initialized separately in app.js
};

module.exports = {
    // Core initialization
    initializeMiddleware,
    
    // Authentication & Authorization
    auth: authMiddleware,
    roleAuth,
    
    // Security middleware
    security: {
        loginLimiter,
        registrationLimiter,
        checkBlockedIP,
        trackFailedLogin,
        passwordStrengthCheck,
        securityHeaders
    },
    
    // Error handling
    initializeErrorHandling
};