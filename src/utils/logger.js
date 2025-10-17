/**
 * Simple logger utility
 * Replaces console.log with proper logging that can be disabled in production
 */

const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
};

class Logger {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.logLevel = process.env.LOG_LEVEL || (this.isProduction ? 'info' : 'debug');
    }

    _shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        return levels.indexOf(level) <= levels.indexOf(this.logLevel);
    }

    _formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`;
    }

    error(message, meta = {}) {
        if (this._shouldLog('error')) {
            console.error(this._formatMessage('error', message, meta));
        }
    }

    warn(message, meta = {}) {
        if (this._shouldLog('warn')) {
            console.warn(this._formatMessage('warn', message, meta));
        }
    }

    info(message, meta = {}) {
        if (this._shouldLog('info')) {
            console.log(this._formatMessage('info', message, meta));
        }
    }

    debug(message, meta = {}) {
        if (this._shouldLog('debug')) {
            console.log(this._formatMessage('debug', message, meta));
        }
    }

    // Sanitize sensitive data before logging
    sanitize(data) {
        if (!data) return data;
        
        const sanitized = { ...data };
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'jwt'];
        
        Object.keys(sanitized).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = '***REDACTED***';
            }
        });
        
        return sanitized;
    }
}

module.exports = new Logger();

