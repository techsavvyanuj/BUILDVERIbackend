const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

// Validation middleware
const registerValidation = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/\d/)
        .withMessage('Password must contain a number'),
    body('firstName').notEmpty().withMessage('First name is required')
        .trim()
        .isLength({ min: 2 })
        .withMessage('First name must be at least 2 characters'),
    body('lastName').notEmpty().withMessage('Last name is required')
        .trim()
        .isLength({ min: 2 })
        .withMessage('Last name must be at least 2 characters'),
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['client_owner', 'vendor_supplier', 'construction_firm'])
        .withMessage('Invalid role'),
    body('phone')
        .if(body('role').isIn(['vendor_supplier', 'construction_firm']))
        .notEmpty()
        .withMessage('Phone number is required for vendors and construction firms')
        .matches(/^[0-9]{10}$/)
        .withMessage('Please provide a valid 10-digit phone number'),
    body('companyName')
        .if(body('role').equals('construction_firm'))
        .notEmpty()
        .withMessage('Company name is required for construction firms'),
    body('gstNumber')
        .if(body('role').equals('construction_firm'))
        .notEmpty()
        .withMessage('GST number is required for construction firms')
        .trim()
        .toUpperCase()
        .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
        .withMessage('Please provide a valid GST number in format: 27ABCDE1234F1Z5')
];

const loginValidation = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['client_owner', 'vendor_supplier', 'construction_firm'])
        .withMessage('Invalid role')
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;