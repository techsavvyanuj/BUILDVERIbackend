const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/apiError');

// Cache decoded tokens to reduce JWT verification overhead
const tokenCache = new Map();
const TOKEN_CACHE_MAX_SIZE = 1000;
const TOKEN_CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes

// Clean expired tokens from cache
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of tokenCache.entries()) {
        if (now > value.expiresAt) {
            tokenCache.delete(key);
        }
    }
}, 5 * 60 * 1000); // Clean every 5 minutes

const authMiddleware = async (req, res, next) => {
    // Set request timeout
    req.setTimeout(30000); // 30 seconds timeout
    try {
        // Check if JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not configured');
            throw new ApiError(500, 'Authentication service configuration error');
        }

        // Get token from header
        let token = req.header('Authorization');
        
        // Check if Authorization header exists
        if (!token) {
            throw new ApiError(401, 'No authentication token provided');
        }

        // Check if it follows Bearer scheme
        if (!token.startsWith('Bearer ')) {
            throw new ApiError(401, 'Invalid token format. Use Bearer scheme');
        }

        // Extract token
        token = token.replace('Bearer ', '').trim();
        
        if (!token) {
            throw new ApiError(401, 'No token found in Bearer scheme');
        }

        try {
            // Check token cache first
            let decoded = tokenCache.get(token);
            
            if (decoded) {
                // Check if cached token is still valid
                if (Date.now() <= decoded.expiresAt) {
                    req.user = decoded.payload;
                    return next();
                } else {
                    // Remove expired token from cache
                    tokenCache.delete(token);
                }
            }

            // Verify token if not in cache
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Validate decoded token structure
            if (!decoded.id || !decoded.role) {
                throw new ApiError(401, 'Invalid token structure');
            }

            // Cache the decoded token
            if (tokenCache.size >= TOKEN_CACHE_MAX_SIZE) {
                // Remove oldest entry if cache is full
                const oldestKey = tokenCache.keys().next().value;
                tokenCache.delete(oldestKey);
            }

            tokenCache.set(token, {
                payload: decoded,
                expiresAt: Date.now() + TOKEN_CACHE_EXPIRY
            });

            // Add user info to request
            req.user = decoded;
            
            next();
        } catch (jwtError) {
            if (jwtError.name === 'JsonWebTokenError') {
                throw new ApiError(401, 'Invalid token');
            } else if (jwtError.name === 'TokenExpiredError') {
                throw new ApiError(401, 'Token has expired');
            }
            throw jwtError;
        }
    } catch (error) {
        // Log error for debugging but don't expose internal details
        console.error('Auth middleware error:', {
            name: error.name,
            message: error.message,
            path: req.path
        });
        
        next(error);
    }
};

// Optional authentication middleware - doesn't fail if no token
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        // Check if JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not configured');
            return next(); // Continue without authentication
        }

        // Get token from header
        let token = req.header('Authorization');
        
        // If no token, continue without authentication
        if (!token) {
            return next();
        }

        // Remove 'Bearer ' prefix if present
        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }

        // Check if token is in cache
        const cachedToken = tokenCache.get(token);
        if (cachedToken && Date.now() < cachedToken.expiresAt) {
            req.user = cachedToken.payload;
            return next();
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check token structure
        if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.role) {
            console.log('Invalid token structure:', decoded);
            return next(); // Continue without authentication
        }

        // Cache the token
        if (tokenCache.size >= TOKEN_CACHE_MAX_SIZE) {
            // Remove oldest entry
            const firstKey = tokenCache.keys().next().value;
            tokenCache.delete(firstKey);
        }
        
        tokenCache.set(token, {
            payload: decoded,
            expiresAt: Date.now() + TOKEN_CACHE_EXPIRY
        });

        req.user = decoded;
        next();
    } catch (error) {
        // If token is invalid, continue without authentication
        console.log('Optional auth error:', error.message);
        next();
    }
};

module.exports = { authMiddleware, optionalAuthMiddleware };
