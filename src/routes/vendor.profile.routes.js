const express = require('express');
const { body, query } = require('express-validator');
const vendorProfileController = require('../controllers/vendor.profile.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const roleAuth = require('../middleware/roleAuth.middleware');

const router = express.Router();

// Validation middleware
const createProfileValidation = [
    body('companyName').trim().notEmpty().withMessage('Company name is required'),
    body('location.city').trim().notEmpty().withMessage('City is required'),
    body('location.state').trim().notEmpty().withMessage('State is required'),
    body('experience.yearsInBusiness')
        .isInt({ min: 0 })
        .withMessage('Years of experience must be a positive number'),
    body('experience.totalProjects')
        .isInt({ min: 0 })
        .withMessage('Total projects must be a positive number'),
    body('services').isArray().withMessage('Services must be an array'),
    body('services.*').trim().notEmpty().withMessage('Service cannot be empty'),
    body('companyPhotos').optional().isArray().withMessage('Company photos must be an array'),
    body('specializations').optional().isArray().withMessage('Specializations must be an array'),
    body('projectRange.minBudget').optional().isInt({ min: 0 }).withMessage('Minimum budget must be a positive number'),
    body('projectRange.maxBudget').optional().isInt({ min: 0 }).withMessage('Maximum budget must be a positive number'),
    body('projectRange.preferredProjectTypes').optional().isArray().withMessage('Preferred project types must be an array'),
    body('certifications').optional().isArray().withMessage('Certifications must be an array'),
];

const searchValidation = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
    query('minExperience').optional().isInt({ min: 0 }).withMessage('Min experience must be a positive number'),
    query('minRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Min rating must be between 0 and 5'),
];

// Routes
router.post(
    '/create',
    authMiddleware,
    roleAuth.vendorOnly,
    createProfileValidation,
    vendorProfileController.createProfile
);

router.put(
    '/update',
    authMiddleware,
    roleAuth.vendorOnly,
    createProfileValidation,
    vendorProfileController.updateProfile
);

// Get own profile
router.get(
    '/profile',
    authMiddleware,
    roleAuth.vendorOnly,
    vendorProfileController.getOwnProfile
);

// Get specific profile by ID
router.get(
    '/profile/:id',
    authMiddleware,
    vendorProfileController.getProfile
);

router.get(
    '/all',
    authMiddleware,
    vendorProfileController.getAllVendors
);

router.get(
    '/search',
    authMiddleware,
    searchValidation,
    vendorProfileController.searchVendors
);

// Vendor Analytics
router.get(
    '/analytics',
    authMiddleware,
    roleAuth.vendorOnly,
    vendorProfileController.getVendorAnalytics
);

// Delete profile (hard delete)
router.delete(
    '/delete',
    authMiddleware,
    roleAuth.vendorOnly,
    vendorProfileController.deleteProfile
);

// Deactivate profile (soft delete)
router.put(
    '/deactivate',
    authMiddleware,
    roleAuth.vendorOnly,
    vendorProfileController.softDeleteProfile
);

module.exports = router;