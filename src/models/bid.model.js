const mongoose = require('mongoose');
const { ApiError } = require('../utils/apiError');

const bidTimelineSchema = new mongoose.Schema({
    proposedStartDate: {
        type: Date,
        required: [true, 'Proposed start date is required'],
        validate: {
            validator: function(value) {
                return value >= new Date();
            },
            message: 'Start date cannot be in the past'
        }
    },
    estimatedDuration: {
        value: {
            type: Number,
            required: [true, 'Duration value is required'],
            min: [1, 'Duration must be positive']
        },
        unit: {
            type: String,
            enum: ['days', 'weeks', 'months'],
            default: 'months'
        }
    },
    milestones: [{
        title: {
            type: String,
            required: [true, 'Milestone title is required']
        },
        description: String,
        expectedCompletionDate: {
            type: Date,
            required: [true, 'Expected completion date is required']
        },
        paymentPercentage: {
            type: Number,
            required: [true, 'Payment percentage is required'],
            min: [0, 'Payment percentage cannot be negative'],
            max: [100, 'Payment percentage cannot exceed 100']
        }
    }]
});

const teamMemberSchema = new mongoose.Schema({
    role: {
        type: String,
        required: [true, 'Team member role is required'],
        enum: ['project_manager', 'architect', 'engineer', 'supervisor', 'labor', 'specialist']
    },
    count: {
        type: Number,
        required: [true, 'Number of team members is required'],
        min: [1, 'Must have at least one team member']
    },
    expertise: [{
        type: String,
        required: true
    }],
    availability: {
        type: String,
        enum: ['full_time', 'part_time', 'on_call'],
        default: 'full_time'
    }
});

const costBreakdownSchema = new mongoose.Schema({
    category: {
        type: String,
        required: [true, 'Cost category is required'],
        enum: ['labor', 'materials', 'equipment', 'permits', 'overhead', 'other']
    },
    description: {
        type: String,
        required: [true, 'Cost description is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    unit: String,
    quantity: {
        type: Number,
        min: [1, 'Quantity must be positive']
    }
});

const bidSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorProfile',
        required: true,
        index: true
    },
    proposedCost: {
        total: {
            type: Number,
            required: [true, 'Total cost is required'],
            min: [0, 'Cost cannot be negative']
        },
        currency: {
            type: String,
            default: 'INR',
            enum: ['INR', 'USD']
        },
        breakdown: [costBreakdownSchema],
        notes: String
    },
    timeline: bidTimelineSchema,
    proposal: {
        summary: {
            type: String,
            required: [true, 'Proposal summary is required'],
            minlength: [100, 'Summary must be at least 100 characters']
        },
        approach: {
            type: String,
            required: [true, 'Project approach is required']
        },
        uniqueValue: String,
        risks: [{
            description: String,
            mitigation: String,
            impact: {
                type: String,
                enum: ['low', 'medium', 'high']
            }
        }]
    },
    previousWork: [{
        projectName: {
            type: String,
            required: true
        },
        description: String,
        completionDate: Date,
        value: Number,
        similarityScore: {
            type: Number,
            min: 0,
            max: 100
        },
        photos: [{
            url: String,
            caption: String
        }]
    }],
    team: {
        composition: [teamMemberSchema],
        projectManager: {
            name: String,
            experience: Number,
            certifications: [String]
        }
    },
    status: {
        current: {
            type: String,
            enum: ['DRAFT', 'PENDING', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
            default: 'DRAFT'
        },
        history: [{
            status: {
                type: String,
                enum: ['DRAFT', 'PENDING', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            reason: String
        }]
    },
    negotiations: [{
        initiator: {
            type: String,
            enum: ['client', 'vendor'],
            required: true
        },
        type: {
            type: String,
            enum: ['cost', 'timeline', 'scope', 'other'],
            required: true
        },
        originalValue: mongoose.Schema.Types.Mixed,
        proposedValue: mongoose.Schema.Types.Mixed,
        message: String,
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    metadata: {
        submittedAt: {
            type: Date
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        clientViewed: {
            type: Boolean,
            default: false
        },
        clientViewedAt: Date,
        competitivenessScore: {
            type: Number,
            min: 0,
            max: 100
        }
    }
}, {
    timestamps: true
});

// Indexes
bidSchema.index({ project: 1, vendor: 1 }, { unique: true });
bidSchema.index({ 'status.current': 1 });
bidSchema.index({ 'proposedCost.total': 1 });
bidSchema.index({ 'metadata.submittedAt': -1 });

// Middleware
bidSchema.pre('save', function(next) {
    // Update metadata
    this.metadata.lastUpdated = new Date();

    // Add status history if status changed
    if (this.isModified('status.current')) {
        this.status.history.push({
            status: this.status.current,
            timestamp: new Date()
        });

        // Set submittedAt when bid is first submitted
        if (this.status.current === 'PENDING' && !this.metadata.submittedAt) {
            this.metadata.submittedAt = new Date();
        }
    }

    next();
});

// Methods
bidSchema.methods.updateStatus = async function(newStatus, reason) {
    const validTransitions = {
        'DRAFT': ['PENDING', 'WITHDRAWN'],
        'PENDING': ['IN_REVIEW', 'WITHDRAWN', 'REJECTED'],
        'IN_REVIEW': ['ACCEPTED', 'REJECTED', 'PENDING'],
        'ACCEPTED': ['IN_REVIEW'], // Allow reverting if needed
        'REJECTED': ['IN_REVIEW'], // Allow reconsidering
        'WITHDRAWN': ['PENDING'] // Allow resubmitting
    };

    if (!validTransitions[this.status.current]?.includes(newStatus)) {
        throw new ApiError(400, `Invalid status transition from ${this.status.current} to ${newStatus}`);
    }

    this.status.current = newStatus;
    this.status.history.push({
        status: newStatus,
        timestamp: new Date(),
        reason
    });

    await this.save();
};

bidSchema.methods.addNegotiation = async function(negotiationData) {
    this.negotiations.push({
        ...negotiationData,
        timestamp: new Date()
    });
    
    await this.save();
    return this.negotiations[this.negotiations.length - 1];
};

bidSchema.methods.markAsViewed = async function() {
    if (!this.metadata.clientViewed) {
        this.metadata.clientViewed = true;
        this.metadata.clientViewedAt = new Date();
        await this.save();
    }
};

// Statics
bidSchema.statics.findCompetingBids = async function(projectId, excludeBidId = null) {
    const query = { project: projectId, 'status.current': { $in: ['PENDING', 'IN_REVIEW'] } };
    
    if (excludeBidId) {
        query._id = { $ne: excludeBidId };
    }

    return this.find(query)
        .select('proposedCost timeline status metadata')
        .sort('proposedCost.total');
};

module.exports = mongoose.model('Bid', bidSchema);
