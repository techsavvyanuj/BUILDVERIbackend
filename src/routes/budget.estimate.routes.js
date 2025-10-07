const express = require('express');
const router = express.Router();
const budgetEstimateController = require('../controllers/budget.estimate.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { body } = require('express-validator');

// Validation middleware
const validateEstimateRequest = [
    body('project_name').notEmpty().trim().withMessage('Project name is required'),
    body('project_type').notEmpty().isIn([
        'residential',
        'commercial',
        'industrial'
    ]).withMessage('Invalid project type'),
    body('location.city').notEmpty().trim().withMessage('City is required'),
    body('location.state').notEmpty().trim().withMessage('State is required'),
    body('project_details.area_sqm')
        .isNumeric().withMessage('Area must be a number')
        .isFloat({ min: 10 }).withMessage('Area must be at least 10 square meters'),
    body('project_details.floors')
        .isInt({ min: 1 }).withMessage('Number of floors must be at least 1'),
    body('project_details.quality_level')
        .isIn(['standard', 'premium']).withMessage('Invalid quality level'),
    body('timeline_months')
        .isInt({ min: 1 }).withMessage('Timeline must be at least 1 month'),
    body('budget_preference')
        .isNumeric().withMessage('Budget preference must be a number')
        .isFloat({ min: 100000 }).withMessage('Budget must be at least 1 lakh INR')
];

// All routes require authentication
router.use(authMiddleware);

// Create new estimate
router.post('/',
    validateEstimateRequest,
    budgetEstimateController.createEstimate
);

// Get specific estimate
router.get('/:id',
    budgetEstimateController.getEstimate
);

// Get all estimates for user
router.get('/',
    budgetEstimateController.getUserEstimates
);

module.exports = router;
