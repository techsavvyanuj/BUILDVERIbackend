const { validationResult } = require('express-validator');
const AuthService = require('../services/auth.service');
const { ApiResponse } = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');

class AuthController {
    constructor() {
        this.authService = new AuthService();
    }

    register = async (req, res, next) => {
        try {
            // Validation
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            console.log('Request body:', {
                ...req.body,
                gstNumber: req.body.gstNumber ? `[${req.body.gstNumber}]` : undefined
            });

            // Basic validation for required fields
            const { email, password, firstName, lastName, role, phone, companyName, gstNumber } = req.body;
            
            // Validate basic required fields
            if (!email?.trim() || !password || !firstName?.trim() || !lastName?.trim() || !role) {
                throw new ApiError(400, 'Email, password, first name, last name, and role are required');
            }

            // Role-specific validation
            switch (role) {
                case 'client_owner':
                    // Client only needs basic fields
                    break;

                case 'vendor_supplier':
                case 'construction_firm':
                    if (!phone) {
                        throw new ApiError(400, `Phone number is required for ${role === 'vendor_supplier' ? 'vendors/suppliers' : 'construction firms'}`);
                    }
                    if (!/^[0-9]{10}$/.test(phone)) {
                        throw new ApiError(400, 'Please provide a valid 10-digit phone number');
                    }

                    if (role === 'construction_firm') {
                        if (!companyName?.trim()) {
                            throw new ApiError(400, 'Company name is required for construction firms');
                        }
                        if (!gstNumber?.trim()) {
                            throw new ApiError(400, 'GST number is required for construction firms');
                        }
                    }
                    break;

                default:
                    throw new ApiError(400, 'Invalid role specified');
            }

            // Pass the complete body to service for processing
            const userData = await this.authService.registerUser(req.body);
            
            return ApiResponse.success(res, userData, 'User registered successfully');
        } catch (error) {
            next(error);
        }
    };

    login = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            const { email, password, role } = req.body;

            // Validate required fields with detailed messages
            if (!email?.trim()) {
                throw new ApiError(400, 'Email is required');
            }
            if (!password?.trim()) {
                throw new ApiError(400, 'Password is required');
            }
            if (!role?.trim()) {
                throw new ApiError(400, 'Role is required');
            }

            // Validate role value
            const validRoles = ['client_owner', 'vendor_supplier', 'construction_firm'];
            if (!validRoles.includes(role)) {
                throw new ApiError(400, 'Invalid role specified');
            }

            // Basic email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                throw new ApiError(400, 'Invalid email format');
            }

            // Log login attempt (but not the password)
            console.log('Login attempt:', {
                email: email.trim(),
                role,
                timestamp: new Date().toISOString()
            });

            const authData = await this.authService.loginUser({ 
                email: email.trim(), 
                password: password.trim(), 
                role: role.trim() 
            });
            
            // Log successful login
            console.log('Successful login:', {
                email: email.trim(),
                role,
                userId: authData.user._id,
                timestamp: new Date().toISOString()
            });

            return ApiResponse.success(res, authData, 'Login successful');
        } catch (error) {
            // Log failed login attempt
            if (req.body.email) {
                console.error('Failed login attempt:', {
                    email: req.body.email.trim(),
                    role: req.body.role,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            next(error);
        }
    };

    getProfile = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const userProfile = await this.authService.getUserProfile(userId);
            
            return ApiResponse.success(res, userProfile, 'Profile retrieved successfully');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new AuthController();