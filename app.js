/**
 * Main Backend API Server for BuildVeritas
 */
require('dotenv').config();
const express = require('express');
const config = require('./src/config');
const { checkEnvironmentVariables } = require('./src/config/environment');
const { initializeMiddleware } = require('./src/middleware');
const { initializeErrorHandling } = require('./src/middleware/errorHandler');
const { initializeRoutes } = require('./src/routes');
const { initializeProcessHandlers } = require('./src/utils/processHandlers');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');

const app = express();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const startServer = async () => {
    try {
        // Check environment
        checkEnvironmentVariables();
        // Connect to database
        await config.database.connect();
        
        // Enable CORS first, before any other middleware
        app.use(config.cors);
        
        // Initialize basic middleware
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        
        // Initialize routes
        initializeRoutes(app);
        
        // Initialize remaining middleware after routes
        initializeMiddleware(app);
        
        // Initialize error handling last
        initializeErrorHandling(app);
        // Initialize process handlers
        initializeProcessHandlers(config.database);
        // Start server
        const PORT = process.env.PORT || 5000;
        const net = require('net');
        
        // Check if port is in use
        const testServer = net.createServer()
            .once('error', err => {
                if (err.code === 'EADDRINUSE') {
                    console.error(`❌ Port ${PORT} is already in use. Please try a different port or kill the process using this port.`);
                    process.exit(1);
                } else {
                    console.error('❌ Error starting server:', err);
                    process.exit(1);
                }
            })
            .once('listening', () => {
                testServer.close();
                app.listen(PORT, () => {
                    console.log(`✅ Server running on port ${PORT}`);
                    console.log(`✅ API available at http://localhost:${PORT}/`);
                    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
                    console.log('Swagger docs at http://localhost:5000/api-docs');
                });
            })
            .listen(PORT);
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
};

startServer();

module.exports = app; // for testing