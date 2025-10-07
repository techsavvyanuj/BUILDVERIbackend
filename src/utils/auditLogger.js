const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Create Winston logger
const auditLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Write all logs to audit.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'audit.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write security events to security.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'security.log'),
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
    auditLogger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

const logAudit = (event, data, userId = null, level = 'info') => {
    auditLogger.log(level, event, {
        userId,
        timestamp: new Date(),
        data,
        ip: data.ip || 'unknown',
        userAgent: data.userAgent || 'unknown'
    });
};

// Security event logging
const logSecurityEvent = (event, data, userId = null) => {
    logAudit(event, data, userId, 'warn');
};

// Admin action logging
const logAdminAction = (action, adminId, data) => {
    logAudit('ADMIN_ACTION', {
        action,
        adminId,
        details: data
    }, adminId, 'warn');
};

// Authentication logging
const logAuthEvent = (event, userId, success, data) => {
    logAudit(event, {
        success,
        ...data
    }, userId, success ? 'info' : 'warn');
};

module.exports = {
    logAudit,
    logSecurityEvent,
    logAdminAction,
    logAuthEvent
};
