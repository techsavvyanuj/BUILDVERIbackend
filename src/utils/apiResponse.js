class ApiResponse {
    static success(res, data, message = 'Success') {
        return res.status(200).json({
            status: 'success',
            message,
            data
        });
    }

    static created(res, data, message = 'Created successfully') {
        return res.status(201).json({
            status: 'success',
            message,
            data
        });
    }

    static error(res, statusCode = 500, message = 'Internal server error', errors = []) {
        return res.status(statusCode).json({
            status: 'error',
            message,
            errors
        });
    }
}

module.exports = {
    ApiResponse
};
