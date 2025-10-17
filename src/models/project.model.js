const mongoose = require('mongoose');
const { ApiError } = require('../utils/apiError');

const projectSpecificationSchema = new mongoose.Schema({
    area: {
        value: {
            type: Number,
            required: [true, 'Area value is required'],
            min: [1, 'Area must be positive']
        },
        unit: {
            type: String,
            enum: ['sqft', 'sqm'],
            default: 'sqft'
        }
    },
    floors: {
        type: Number,
        required: [true, 'Number of floors is required'],
        min: [1, 'Must have at least one floor']
    },
    requirements: [{
        category: {
            type: String,
            required: true,
            enum: ['structural', 'electrical', 'plumbing', 'interior', 'exterior', 'other']
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        priority: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium'
        }
    }]
});

const projectTimelineSchema = new mongoose.Schema({
    expectedStartDate: {
        type: Date,
        required: [true, 'Expected start date is required']
    },
    expectedDuration: {
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
    preferredWorkingHours: {
        start: {
            type: String,
            match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'],
            default: '09:00'
        },
        end: {
            type: String,
            match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'],
            default: '18:00'
        }
    }
});

const projectSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientProfile',
        required: true,
        index: true,
        validate: {
            validator: async function(value) {
                const ClientProfile = mongoose.model('ClientProfile');
                const profile = await ClientProfile.findById(value);
                return profile !== null;
            },
            message: 'Referenced client profile does not exist'
        }
    },
    title: {
        type: String,
        required: [true, 'Project title is required'],
        trim: true,
        minlength: [5, 'Title must be at least 5 characters'],
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Project description is required'],
        trim: true,
        minlength: [20, 'Description must be at least 20 characters']
    },
    budget: {
        range: {
            min: {
                type: Number,
                required: [true, 'Minimum budget is required'],
                min: [0, 'Budget cannot be negative']
            },
            max: {
                type: Number,
                required: [true, 'Maximum budget is required'],
                validate: {
                    validator: function(value) {
                        return value > this.budget.range.min;
                    },
                    message: 'Maximum budget must be greater than minimum budget'
                }
            }
        },
        currency: {
            type: String,
            default: 'INR',
            enum: ['INR', 'USD']
        },
        flexibility: {
            type: String,
            enum: ['strict', 'flexible', 'very_flexible'],
            default: 'flexible'
        }
    },
    location: {
        address: {
            type: String,
            required: [true, 'Address is required'],
            trim: true
        },
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true
        },
        state: {
            type: String,
            required: [true, 'State is required'],
            trim: true
        },
        pincode: {
            type: String,
            required: [true, 'Pincode is required'],
            match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit pincode']
        },
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                required: false
            },
            coordinates: {
                type: [Number],
                required: false,
                validate: {
                    validator: function(v) {
                        if (!v) return true; // Allow empty coordinates
                        return v.length === 2 && 
                               v[0] >= -180 && v[0] <= 180 && 
                               v[1] >= -90 && v[1] <= 90;
                    },
                    message: 'Invalid coordinates'
                }
            }
        }
    },
    projectType: {
        type: String,
        required: [true, 'Project type is required'],
        enum: {
            values: ['residential', 'commercial', 'industrial', 'infrastructure'],
            message: 'Invalid project type'
        }
    },
    subType: {
        residential: {
            type: String,
            enum: ['apartment', 'villa', 'house', 'renovation'],
            required: function() {
                return this.projectType === 'residential';
            }
        },
        commercial: {
            type: String,
            enum: ['office', 'retail', 'hotel', 'warehouse'],
            required: function() {
                return this.projectType === 'commercial';
            }
        }
    },
    specifications: projectSpecificationSchema,
    timeline: projectTimelineSchema,
    status: {
        current: {
            type: String,
            enum: ['DRAFT', 'OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
            default: 'DRAFT'
        },
        history: [{
            status: {
                type: String,
                enum: ['DRAFT', 'OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            reason: String
        }]
    },
    attachments: [{
        type: {
            type: String,
            enum: ['document', 'image', 'blueprint'],
            required: true
        },
        url: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        size: Number,
        format: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    preferences: {
        vendorRequirements: {
            minExperience: {
                type: Number,
                min: 0,
                default: 0
            },
            minRating: {
                type: Number,
                min: 0,
                max: 5,
                default: 0
            },
            requiredCertifications: [String],
            preferredLocations: [{
                city: String,
                state: String
            }]
        },
        communicationPreference: {
            type: String,
            enum: ['email', 'phone', 'both'],
            default: 'both'
        }
    },
    visibility: {
        type: String,
        enum: ['public', 'private', 'invited'],
        default: 'public'
    },
    metadata: {
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        },
        updatedAt: {
            type: Date,
            default: Date.now
        },
        lastActivityAt: {
            type: Date,
            default: Date.now
        },
        views: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Indexes
projectSchema.index({ 'location.city': 1, 'location.state': 1 });
projectSchema.index({ 'location.coordinates': '2dsphere' });
projectSchema.index({ 'status.current': 1 });
projectSchema.index({ 'projectType': 1 });
projectSchema.index({ 'budget.range.min': 1, 'budget.range.max': 1 });
projectSchema.index({ 'metadata.createdAt': -1 });

// Middleware
projectSchema.pre('save', function(next) {
    // Update metadata
    this.metadata.updatedAt = new Date();
    this.metadata.lastActivityAt = new Date();

    // Add status history if status changed
    if (this.isModified('status.current')) {
        this.status.history.push({
            status: this.status.current,
            timestamp: new Date()
        });
    }

    next();
});

// Methods
projectSchema.methods.updateStatus = async function(newStatus, reason) {
    if (this.status.current !== newStatus) {
        this.status.current = newStatus;
        this.status.history.push({
            status: newStatus,
            timestamp: new Date(),
            reason: reason
        });
        await this.save();
    }
};

projectSchema.methods.incrementViews = async function() {
    this.metadata.views += 1;
    this.metadata.lastActivityAt = new Date();
    await this.save();
};

// Statics
projectSchema.statics.findNearby = async function(coordinates, maxDistance = 50000) {
    return this.find({
        'location.coordinates': {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: coordinates
                },
                $maxDistance: maxDistance
            }
        }
    });
};

projectSchema.statics.findMatchingVendors = async function(projectId) {
    const project = await this.findById(projectId);
    if (!project) {
        throw new ApiError(404, 'Project not found');
    }

    // This would be implemented in the project service
    // to find vendors matching project criteria
    return [];
};

module.exports = mongoose.model('Project', projectSchema);
