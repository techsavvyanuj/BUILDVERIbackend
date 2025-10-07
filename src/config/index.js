/**
 * Central configuration export
 * All configurations should be imported and exported from here
 */

const database = require('./database');
const cors = require('./cors');
const helmet = require('./helmet');
const rateLimiter = require('./rate-limiter');
const { checkEnvironmentVariables } = require('./environment');
const swaggerSpec = require('./swagger');
const security = require('./security');

// Initialize and validate environment variables
checkEnvironmentVariables();

module.exports = {
    // Core configurations
    database,
    cors,
    helmet,
    rateLimiter,
    security,
    
    // API Documentation
    swaggerSpec,
    
    // Environment validation
    checkEnvironmentVariables
};