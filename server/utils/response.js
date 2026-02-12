// Response helpers for consistent API format
export const apiResponse = {
    success: (res, data, meta = {}) => {
        res.json({
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        });
    },
    created: (res, data, meta = {}) => {
        res.status(201).json({
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        });
    },
    error: (res, message, statusCode = 500, details = null) => {
        res.status(statusCode).json({
            success: false,
            error: {
                message,
                ...(details && { details })
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
};
