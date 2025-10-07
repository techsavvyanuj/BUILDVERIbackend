const express = require('express');
const router = express.Router();
const VendorProjectPlan = require('../models/vendorProjectPlan.model');
const Project = require('../models/project.model');
const { authMiddleware } = require('../middleware/auth.middleware');

// Get all vendor project plans for a project (Client view)
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { projectId };
    if (status) {
      query.status = status;
    }

    const plans = await VendorProjectPlan.find(query)
      .populate('vendorId', 'name email phone')
      .populate('projectId', 'title description')
      .sort({ 'metadata.createdAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VendorProjectPlan.countDocuments(query);

    res.json({
      status: 'success',
      message: 'Vendor project plans retrieved successfully',
      data: {
        docs: plans,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching vendor project plans:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch vendor project plans',
      error: error.message
    });
  }
});

// Get vendor project plan by ID
router.get('/:planId', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await VendorProjectPlan.findById(planId)
      .populate('vendorId', 'name email phone')
      .populate('projectId', 'title description')
      .populate('clientId', 'name email');

    if (!plan) {
      return res.status(404).json({
        status: 'error',
        message: 'Vendor project plan not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Vendor project plan retrieved successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error fetching vendor project plan:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch vendor project plan',
      error: error.message
    });
  }
});

// Submit vendor project plan (Vendor action)
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const vendorId = req.user.id;
    const planData = req.body;

    // Validate required fields
    const requiredFields = [
      'projectId', 'planTitle', 'planDescription', 'timeline', 'resources', 'budget'
    ];
    
    for (const field of requiredFields) {
      if (!planData[field]) {
        return res.status(400).json({
          status: 'error',
          message: `${field} is required`
        });
      }
    }

    // Check if project exists
    const project = await Project.findById(planData.projectId);
    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Get vendor profile to check if vendor has accepted bid for this project
    const VendorProfile = require('mongoose').model('VendorProfile');
    const vendorProfile = await VendorProfile.findOne({ user: vendorId });
    
    if (!vendorProfile) {
      return res.status(403).json({
        status: 'error',
        message: 'Vendor profile not found'
      });
    }

    // Check if vendor has an accepted bid for this project
    const Bid = require('mongoose').model('Bid');
    const acceptedBid = await Bid.findOne({
      project: planData.projectId,
      vendor: vendorProfile._id,
      'status.current': 'ACCEPTED'
    });

    if (!acceptedBid) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to submit a plan for this project. You need to have an accepted bid first.'
      });
    }

    // Check if vendor has already submitted a plan for this project
    const existingPlan = await VendorProjectPlan.findOne({
      projectId: planData.projectId,
      vendorId: vendorId
    });

    if (existingPlan) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already submitted a project plan for this project'
      });
    }

    // Get client user ID from client profile
    const ClientProfile = require('mongoose').model('ClientProfile');
    const clientProfile = await ClientProfile.findById(project.client);
    
    if (!clientProfile) {
      return res.status(400).json({
        status: 'error',
        message: 'Client profile not found for this project'
      });
    }

    // Create vendor project plan
    const vendorProjectPlan = new VendorProjectPlan({
      ...planData,
      vendorId: vendorId,
      clientId: clientProfile.user, // Use the user ID from client profile
      status: 'submitted'
    });

    await vendorProjectPlan.save();

    res.status(201).json({
      status: 'success',
      message: 'Vendor project plan submitted successfully',
      data: vendorProjectPlan
    });
  } catch (error) {
    console.error('Error submitting vendor project plan:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit vendor project plan',
      error: error.message
    });
  }
});

// Request project plan from vendor (Client action)
router.post('/request/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const clientId = req.user.id;

    // Check if project exists and belongs to client
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Check if project has client
    if (!project.client) {
      return res.status(400).json({
        status: 'error',
        message: 'Project does not have a client assigned'
      });
    }

    if (project.client.toString() !== clientId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to request project plans for this project. This project belongs to a different client.'
      });
    }

    // Check if project has accepted bid (vendor selected)
    if (!project.acceptedBid || !project.vendorId) {
      return res.status(403).json({
        status: 'error',
        message: 'No vendor has been selected for this project yet. Please wait for a vendor to be assigned.'
      });
    }

    res.json({
      status: 'success',
      message: 'Project plan request sent to vendor successfully'
    });
  } catch (error) {
    console.error('Error requesting project plan:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to request project plan',
      error: error.message
    });
  }
});

// Request progress update (Client action)
router.post('/progress-request/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const clientId = req.user.id;

    // Check if project exists and belongs to client
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    if (project.client.toString() !== clientId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to request progress updates for this project'
      });
    }

    // Check if project has vendor
    if (!project.vendorId) {
      return res.status(400).json({
        status: 'error',
        message: 'No vendor assigned to this project'
      });
    }

    res.json({
      status: 'success',
      message: 'Progress update request sent to vendor successfully'
    });
  } catch (error) {
    console.error('Error requesting progress update:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to request progress update',
      error: error.message
    });
  }
});

// Update project plan status (Client action - approve/reject)
router.patch('/:planId/status', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.params;
    const { status, feedback, approvalNotes } = req.body;
    const clientId = req.user.id;

    const validStatuses = ['approved', 'rejected', 'revision_requested'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be one of: approved, rejected, revision_requested'
      });
    }

    const plan = await VendorProjectPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        status: 'error',
        message: 'Vendor project plan not found'
      });
    }

    if (plan.clientId.toString() !== clientId) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to update this project plan'
      });
    }

    // Update project plan status
    plan.status = status;
    plan.review.reviewedBy = clientId;
    plan.review.reviewedAt = new Date();
    plan.review.feedback = feedback;
    plan.review.approvalNotes = approvalNotes;

    await plan.save();

    res.json({
      status: 'success',
      message: `Project plan ${status} successfully`,
      data: plan
    });
  } catch (error) {
    console.error('Error updating project plan status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update project plan status',
      error: error.message
    });
  }
});

module.exports = router;
