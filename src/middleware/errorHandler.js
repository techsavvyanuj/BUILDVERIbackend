/**
 * Global error handling middleware
 */
const { ApiError } = require('../utils/apiError');
const { ApiResponse } = require('../utils/apiResponse');

const initializeErrorHandling = (app) => {
    // 404 handler
    app.use((req, res, next) => {
        next(new ApiError(404, 'Resource not found'));
    });

    // Global error handler
    app.use((err, req, res, next) => {
        console.error(err);

        if (err instanceof ApiError) {
            return ApiResponse.error(res, err.statusCode, err.message, err.errors);
        }

        // MongoDB duplicate key error
        if (err.code === 11000) {
            return ApiResponse.error(res, 400, 'Duplicate value error', [
                { field: Object.keys(err.keyPattern)[0], message: 'Already exists' }
            ]);
        }

        // Mongoose validation error
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => ({
                field: e.path,
                message: e.message
            }));
            return ApiResponse.error(res, 400, 'Validation Error', errors);
        }

        // JWT errors
        if (err.name === 'JsonWebTokenError') {
            return ApiResponse.error(res, 401, 'Invalid token');
        }

        if (err.name === 'TokenExpiredError') {
            return ApiResponse.error(res, 401, 'Token has expired');
        }

        return ApiResponse.error(
            res, 
            500, 
            process.env.NODE_ENV === 'development' 
                ? err.message 
                : 'Internal server error'
        );
    });
};

module.exports = {
    initializeErrorHandling
};
