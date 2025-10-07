const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/user.repository');
const { ApiError } = require('../utils/apiError');

// Constants for performance optimization
const SALT_ROUNDS = 9;  // Optimized for ~40ms hashing time while maintaining good security
const TOKEN_EXPIRY = '24h';
const LOGIN_TIMEOUT = 15000; // 15 seconds for free tier latency
const REGISTRATION_TIMEOUT = 20000; // 20 seconds timeout for registration on free tier

// Cache for frequently accessed users
const userCache = new Map();
const USER_CACHE_MAX_SIZE = 1000;
const USER_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Precompute regex patterns for validation
const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
const PHONE_REGEX = /^[0-9]{10}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const validRoles = ['client_owner', 'vendor_supplier', 'construction_firm'];

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
        
        // Clean expired users from cache periodically
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of userCache.entries()) {
                if (now > value.expiresAt) {
                    userCache.delete(key);
                }
            }
        }, 60000); // Clean every minute
    }

    // Helper method to manage user cache
    async getCachedUser(email) {
        const cachedUser = userCache.get(email);
        if (cachedUser && Date.now() <= cachedUser.expiresAt) {
            return cachedUser.user;
        }
        return null;
    }

    // Helper method to cache user
    cacheUser(email, user) {
        if (userCache.size >= USER_CACHE_MAX_SIZE) {
            const oldestKey = userCache.keys().next().value;
            userCache.delete(oldestKey);
        }
        userCache.set(email, {
            user,
            expiresAt: Date.now() + USER_CACHE_EXPIRY
        });
    }

    async registerUser(data) {
        try {
            // Set timeout for registration
            const registrationPromise = this._performRegistration(data);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new ApiError(408, 'Registration request timed out')), REGISTRATION_TIMEOUT);
            });

            return await Promise.race([registrationPromise, timeoutPromise]);
        } catch (error) {
            if (error.statusCode === 408) {
                console.error('Registration timeout:', { email: data.email, role: data.role });
            }
            throw error;
        }
    }

    async _performRegistration(data) {
        // Clean data first (synchronous operations)
        const cleanData = this._sanitizeInputData(data);
        
        // Validate data synchronously before any async operations
        this._validateRegistrationData(cleanData);

        // Step 1: Check existence and hash password in parallel
        const [existingUser, hashedPassword] = await Promise.all([
            this.userRepository.findByEmail(cleanData.email),
            bcrypt.hash(cleanData.password, SALT_ROUNDS)
        ]);

        if (existingUser) {
            throw new ApiError(400, 'User already exists');
        }

        // Prepare user data
        const userData = {
            email: cleanData.email,
            password: hashedPassword,
            firstName: cleanData.firstName,
            lastName: cleanData.lastName,
            role: cleanData.role,
            phone: cleanData.phone
        };

        // Add role-specific fields
        if (cleanData.role === 'construction_firm') {
            userData.companyName = cleanData.companyName;
            userData.gstNumber = cleanData.gstNumber;
        }

        // Step 2: Create user first, then generate token and prepare cache in parallel
        const user = await this.userRepository.create(userData);
        
        const [token, cacheKey] = await Promise.all([
            this.generateToken(user),  // Use the actual user object from database
            this._prepareCacheKey(cleanData.email)  // Prepare cache key in parallel
        ]);

        // Step 3: Update cache and prepare response in parallel
        await Promise.all([
            this.cacheUser(cacheKey, user),
            this._updateLoginAttempts(cleanData.email, true)  // Clear any previous failed attempts
        ]);

        return {
            user: this.sanitizeUser(user),
            token
        };
    }

    _sanitizeInputData(data) {
        return {
            email: data.email?.trim().toLowerCase(),
            password: data.password,
            firstName: data.firstName?.trim(),
            lastName: data.lastName?.trim(),
            role: data.role,
            phone: data.phone?.trim(),
            companyName: data.companyName?.trim(),
            gstNumber: data.role === 'construction_firm' ? 
                data.gstNumber?.trim().toUpperCase() : undefined
        };
    }

    _validateRegistrationData(data) {
        // Validate required fields
        if (!data.email || !data.password || !data.firstName || 
            !data.lastName || !data.role) {
            throw new ApiError(400, 'Missing required fields');
        }

        // Validate email format
        if (!EMAIL_REGEX.test(data.email)) {
            throw new ApiError(400, 'Invalid email format');
        }

        // Validate role
        if (!validRoles.includes(data.role)) {
            throw new ApiError(400, 'Invalid role specified');
        }

        // Validate phone for vendor/construction
        if ((data.role === 'vendor_supplier' || data.role === 'construction_firm') &&
            (!data.phone || !PHONE_REGEX.test(data.phone))) {
            throw new ApiError(400, 'Valid phone number is required for vendors and construction firms');
        }

        // Validate construction firm specific fields
        if (data.role === 'construction_firm') {
            if (!data.companyName) {
                throw new ApiError(400, 'Company name is required for construction firms');
            }
            if (!data.gstNumber || !GST_REGEX.test(data.gstNumber)) {
                throw new ApiError(400, 'Invalid GST number format. Example: 27ABCDE1234F1Z5');
            }
        }
    }

    async loginUser({ email, password, role }) {
        try {
            // Set timeout for login operation
            const loginPromise = this._performLogin({ email, password, role });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new ApiError(408, 'Login request timed out')), LOGIN_TIMEOUT);
            });

            return await Promise.race([loginPromise, timeoutPromise]);
        } catch (error) {
            if (error.statusCode === 408) {
                console.error('Login timeout:', { email, role });
            }
            throw error;
        }
    }

    async _performLogin({ email, password, role }) {
        try {
            // Step 1: Quick synchronous validations and data cleaning
            if (!email || !password || !role) {
                throw new ApiError(400, 'Email, password, and role are required');
            }

            const normalizedEmail = email.trim().toLowerCase();
            const cleanPassword = password.trim();
            const cleanRole = role.trim();

            // Validate format synchronously
            if (!EMAIL_REGEX.test(normalizedEmail) || !validRoles.includes(cleanRole)) {
                throw new ApiError(400, 'Invalid email format or role');
            }

            // Step 2: Parallel operations - check cache and prepare cache key
            const [cachedUser, cacheKey] = await Promise.all([
                this.getCachedUser(normalizedEmail),
                this._prepareCacheKey(normalizedEmail)
            ]);

            // Step 3: If cache miss, get user from DB
            let user = cachedUser;
            let isCacheHit = Boolean(cachedUser);

            if (!user) {
                user = await this.userRepository.findByEmail(normalizedEmail);
                if (!user) {
                    throw new ApiError(404, 'No account found with this email. Please sign up first.');
                }
            }

            // Quick role check before expensive operations
            if (user.role !== cleanRole) {
                throw new ApiError(401, 'Invalid role for this account');
            }

            // Step 4: Parallel operations - verify password, generate token, and prepare cache
            const [isPasswordValid, token] = await Promise.all([
                bcrypt.compare(cleanPassword, user.password),
                this.generateToken(user)
            ]);

            if (!isPasswordValid) {
                // Update failed attempts and throw error
                await this._updateLoginAttempts(normalizedEmail, false);
                throw new ApiError(401, 'Incorrect password. Please try again.');
            }

            // Step 5: Final parallel operations - update cache and login attempts
            if (!isCacheHit) {
                await Promise.all([
                    this.cacheUser(cacheKey, user),
                    this._updateLoginAttempts(normalizedEmail, true)
                ]);
            } else {
                await this._updateLoginAttempts(normalizedEmail, true);
            }

            return {
                user: this.sanitizeUser(user),
                token,
                cached: isCacheHit
            };
        } catch (error) {
            // Update failed login attempts
            if (email) {
                this._updateLoginAttempts(email.trim().toLowerCase(), false);
            }
            throw error;
        }
    }

    // Track login attempts for security
    _updateLoginAttempts(email, success) {
        const key = `login_attempts_${email}`;
        const attempts = userCache.get(key) || { count: 0, lastAttempt: 0 };
        
        if (success) {
            userCache.delete(key);
        } else {
            attempts.count += 1;
            attempts.lastAttempt = Date.now();
            userCache.set(key, attempts);

            // If too many failed attempts, implement exponential backoff
            if (attempts.count > 5) {
                const backoffTime = Math.min(Math.pow(2, attempts.count - 5) * 1000, 30000);
                throw new ApiError(429, `Too many failed attempts. Please try again in ${Math.ceil(backoffTime/1000)} seconds`);
            }
        }
    }

    async getUserProfile(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }
        return this.sanitizeUser(user);
    }

    generateToken(user) {
        try {
            return jwt.sign(
                { 
                    id: user._id,
                    role: user.role
                },
                process.env.JWT_SECRET,
                { 
                    expiresIn: TOKEN_EXPIRY,
                    algorithm: 'HS256' // Specify faster algorithm
                }
            );
        } catch (error) {
            console.error('Token generation error:', error);
            throw new ApiError(500, 'Failed to generate authentication token');
        }
    }

    sanitizeUser(user) {
        const { password, ...sanitizedUser } = user.toObject();
        // Add id field for frontend compatibility
        sanitizedUser.id = sanitizedUser._id;
        
        console.log('AuthService: Sanitized user object:', {
            _id: sanitizedUser._id,
            id: sanitizedUser.id,
            email: sanitizedUser.email,
            role: sanitizedUser.role
        });
        
        return sanitizedUser;
    }

    _prepareCacheKey(email) {
        return `user_${email.toLowerCase()}`;
    }
}

module.exports = AuthService;