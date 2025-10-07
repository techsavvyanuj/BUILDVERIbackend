const { ApiError } = require('../utils/apiError');

/**
 * Middleware to check if user has required role(s)
 * @param {string|string[]} allowedRoles - Single role or array of roles allowed to access the route
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new ApiError(401, 'Authentication required');
            }

            const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
            
            if (!roles.includes(req.user.role)) {
                throw new ApiError(403, 'Access denied. Insufficient role permissions.');
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

// Predefined role combinations for common use cases
const roleAuth = {
    // Base middleware
    check: checkRole,
    
    // Single role checks
    clientOnly: checkRole(['client_owner']),
    vendorOnly: checkRole(['vendor_supplier']),
    constructionOnly: checkRole(['construction_firm']),
    
    // Combined role checks
    clientAndVendor: checkRole(['client_owner', 'vendor_supplier']),
    clientAndConstruction: checkRole(['client_owner', 'construction_firm']),
    vendorAndConstruction: checkRole(['vendor_supplier', 'construction_firm']),
    
    // All business roles
    allBusinessRoles: checkRole(['client_owner', 'vendor_supplier', 'construction_firm'])
};

module.exports = roleAuth;