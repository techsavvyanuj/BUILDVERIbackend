const express = require('express');
const { body } = require('express-validator');
const clientProfileController = require('../controllers/client.profile.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const roleAuth = require('../middleware/roleAuth.middleware');
const multer = require('multer');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/client-photos/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
    }
});

const upload = multer({ storage: storage });

// Validation middleware
const profileValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone')
        .matches(/^[0-9]{10}$/)
        .withMessage('Please enter a valid 10-digit phone number'),
    body('address').trim().notEmpty().withMessage('Address is required')
];

const projectValidation = [
    body('name').trim().notEmpty().withMessage('Project name is required'),
    body('status')
        .isIn(['planning', 'in_progress', 'completed'])
        .withMessage('Invalid project status')
];

// Routes
router.post(
    '/profile',
    authMiddleware,
    roleAuth.clientOnly,
    profileValidation,
    clientProfileController.createOrUpdateProfile
);

router.get(
    '/profile',
    authMiddleware,
    roleAuth.clientOnly,
    clientProfileController.getProfile
);

router.post(
    '/projects',
    authMiddleware,
    roleAuth.clientOnly,
    projectValidation,
    clientProfileController.addProject
);

router.put(
    '/projects/:projectId',
    authMiddleware,
    roleAuth.clientOnly,
    projectValidation,
    clientProfileController.updateProject
);

router.delete(
    '/projects/:projectId',
    authMiddleware,
    roleAuth.clientOnly,
    clientProfileController.deleteProject
);

router.post(
    '/photos',
    authMiddleware,
    roleAuth.clientOnly,
    upload.array('photos', 5), // Max 5 photos at once
    clientProfileController.uploadPhotos
);

module.exports = router;