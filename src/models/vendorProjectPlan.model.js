const mongoose = require('mongoose');

const vendorProjectPlanSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Plan Details
  planTitle: {
    type: String,
    required: true,
    trim: true
  },
  planDescription: {
    type: String,
    required: true,
    trim: true
  },
  
  // Timeline Details
  timeline: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    duration: {
      value: {
        type: Number,
        required: true
      },
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months'],
        required: true
      }
    },
    milestones: [{
      name: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      expectedDate: {
        type: Date,
        required: true
      },
      deliverables: [{
        type: String,
        required: true
      }],
      dependencies: [{
        type: String
      }]
    }]
  },
  
  // Resource Planning
  resources: {
    teamSize: {
      type: Number,
      required: true,
      min: 1
    },
    teamRoles: [{
      role: {
        type: String,
        required: true
      },
      count: {
        type: Number,
        required: true,
        min: 1
      },
      responsibilities: [{
        type: String,
        required: true
      }]
    }],
    equipment: [{
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      specifications: {
        type: String
      }
    }],
    materials: [{
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      unit: {
        type: String,
        required: true
      },
      specifications: {
        type: String
      }
    }]
  },
  
  // Budget Breakdown
  budget: {
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    breakdown: [{
      category: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String
      }
    }],
    paymentSchedule: [{
      milestone: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      dueDate: {
        type: Date,
        required: true
      },
      percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      }
    }]
  },
  
  // Quality Assurance
  qualityAssurance: {
    standards: [{
      type: String,
      required: true
    }],
    checkpoints: [{
      name: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      frequency: {
        type: String,
        required: true
      },
      criteria: [{
        type: String,
        required: true
      }]
    }],
    testingProcedures: [{
      name: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      frequency: {
        type: String,
        required: true
      }
    }]
  },
  
  // Risk Management
  riskManagement: {
    identifiedRisks: [{
      risk: {
        type: String,
        required: true
      },
      impact: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true
      },
      probability: {
        type: String,
        enum: ['low', 'medium', 'high'],
        required: true
      },
      mitigationStrategy: {
        type: String,
        required: true
      },
      contingencyPlan: {
        type: String
      }
    }],
    safetyMeasures: [{
      type: String,
      required: true
    }]
  },
  
  // Communication Plan
  communication: {
    reportingFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'bi-weekly', 'monthly'],
      required: true
    },
    reportingFormat: {
      type: String,
      required: true
    },
    contactPersons: [{
      name: {
        type: String,
        required: true
      },
      role: {
        type: String,
        required: true
      },
      contact: {
        type: String,
        required: true
      }
    }],
    meetingSchedule: [{
      type: {
        type: String,
        required: true
      },
      frequency: {
        type: String,
        required: true
      },
      participants: [{
        type: String,
        required: true
      }]
    }]
  },
  
  // Documents and Attachments
  documents: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['technical_drawing', 'specification', 'permit', 'certificate', 'other'],
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status and Approval
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested'],
    default: 'draft'
  },
  
  // Review and Feedback
  review: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    feedback: {
      type: String
    },
    approvalNotes: {
      type: String
    }
  },
  
  // AI Analysis Results (for future implementation)
  aiAnalysis: {
    feasibilityScore: {
      type: Number,
      min: 0,
      max: 100
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    timelineAccuracy: {
      type: Number,
      min: 0,
      max: 100
    },
    budgetAccuracy: {
      type: Number,
      min: 0,
      max: 100
    },
    recommendations: [{
      type: String
    }],
    analyzedAt: {
      type: Date
    }
  },
  
  // Metadata
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
vendorProjectPlanSchema.index({ projectId: 1, vendorId: 1 });
vendorProjectPlanSchema.index({ clientId: 1, status: 1 });
vendorProjectPlanSchema.index({ 'metadata.createdAt': -1 });

// Update the updatedAt field before saving
vendorProjectPlanSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('VendorProjectPlan', vendorProjectPlanSchema);
