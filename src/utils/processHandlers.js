/**
 * Process event handlers for graceful shutdown and error handling
 */

const initializeProcessHandlers = (database) => {
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received: closing HTTP server');
        database.disconnect()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('❌ Uncaught Exception:', err);
        process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
        console.error('❌ Unhandled Promise Rejection:', err);
        process.exit(1);
    });
};

module.exports = {
    initializeProcessHandlers
};
