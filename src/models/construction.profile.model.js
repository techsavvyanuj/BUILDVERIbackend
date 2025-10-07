const mongoose = require('mongoose');

const constructionProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    companyName: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true
    },
    location: {
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true
        },
        state: {
            type: String,
            required: [true, 'State is required'],
            trim: true
        }
    },
    experience: {
        yearsInBusiness: {
            type: Number,
            required: [true, 'Years of experience is required'],
            min: [0, 'Years of experience cannot be negative']
        },
        totalProjects: {
            type: Number,
            required: [true, 'Total number of projects is required'],
            min: [0, 'Total projects cannot be negative']
        }
    },
    // Construction firm specific fields
    gstDetails: {
        number: {
            type: String,
            required: [true, 'GST number is required'],
            match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
        },
        registrationDate: {
            type: Date,
            required: [true, 'GST registration date is required']
        }
    },
    licenses: [{
        type: {
            type: String,
            required: [true, 'License type is required'],
            enum: ['state', 'central', 'municipal', 'other']
        },
        number: {
            type: String,
            required: [true, 'License number is required']
        },
        issuedBy: {
            type: String,
            required: [true, 'Issuing authority is required']
        },
        validUntil: {
            type: Date,
            required: [true, 'License validity date is required']
        }
    }],
    equipmentOwned: [{
        name: {
            type: String,
            required: [true, 'Equipment name is required']
        },
        quantity: {
            type: Number,
            required: [true, 'Equipment quantity is required'],
            min: [1, 'Quantity must be at least 1']
        },
        specifications: {
            type: String
        }
    }],
    activeProjects: [{
        name: {
            type: String,
            required: [true, 'Project name is required'],
            trim: true
        },
        location: {
            type: String,
            required: [true, 'Project location is required']
        },
        startDate: {
            type: Date,
            required: [true, 'Project start date is required']
        },
        expectedCompletion: {
            type: Date,
            required: [true, 'Expected completion date is required']
        },
        status: {
            type: String,
            enum: ['planning', 'in_progress', 'completed', 'on_hold'],
            default: 'planning'
        },
        type: {
            type: String,
            required: [true, 'Project type is required'],
            enum: ['residential', 'commercial', 'industrial', 'infrastructure', 'other']
        },
        value: {
            type: Number,
            required: [true, 'Project value is required'],
            min: [0, 'Project value cannot be negative']
        }
    }],
    specializations: [{
        type: String,
        enum: [
            'residential_construction',
            'commercial_construction',
            'industrial_construction',
            'infrastructure_development',
            'interior_construction',
            'renovation',
            'sustainable_construction',
            'other'
        ]
    }],
    projectCapacity: {
        budgetRange: {
            minBudget: {
                type: Number,
                required: [true, 'Minimum project budget is required'],
                min: [0, 'Minimum budget cannot be negative']
            },
            maxBudget: {
                type: Number,
                required: [true, 'Maximum project budget is required'],
                min: [0, 'Maximum budget cannot be negative']
            }
        },
        operationalRegions: [{
            city: {
                type: String,
                required: true
            },
            state: {
                type: String,
                required: true
            },
            isMainBranch: {
                type: Boolean,
                default: false
            }
        }],
        simultaneousProjects: {
            current: {
                type: Number,
                default: 0,
                min: 0
            },
            maximum: {
                type: Number,
                required: [true, 'Maximum simultaneous projects capacity is required'],
                min: 1
            }
        },
        projectSizeRange: {
            minSquareFeet: {
                type: Number,
                required: [true, 'Minimum project size is required'],
                min: 0
            },
            maxSquareFeet: {
                type: Number,
                required: [true, 'Maximum project size is required'],
                min: 0
            }
        }
    },
    certifications: [{
        name: {
            type: String,
            required: true
        },
        issuedBy: {
            type: String,
            required: true
        },
        year: {
            type: Number,
            required: true
        },
        validUntil: {
            type: Date
        }
    }],
    companyLogo: {
        type: String
    },
    companyPhotos: [{
        type: String
    }],
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        }
    },
    financialDetails: {
        annualTurnover: {
            type: Number,
            required: [true, 'Annual turnover is required'],
            min: [0, 'Annual turnover cannot be negative']
        },
        bankingInfo: {
            bankName: {
                type: String,
                required: [true, 'Bank name is required']
            },
            accountType: {
                type: String,
                required: [true, 'Account type is required'],
                enum: ['savings', 'current']
            },
            ifscCode: {
                type: String,
                required: [true, 'IFSC code is required'],
                match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please enter a valid IFSC code']
            }
        }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
constructionProfileSchema.index({ 'location.city': 1, 'location.state': 1 });
constructionProfileSchema.index({ 'ratings.average': -1 });
constructionProfileSchema.index({ 'experience.yearsInBusiness': -1 });
constructionProfileSchema.index({ 'specializations': 1 });
constructionProfileSchema.index({ 'activeProjects.status': 1 });
constructionProfileSchema.index({ 'projectCapacity.budgetRange.minBudget': 1, 'projectCapacity.budgetRange.maxBudget': 1 });
constructionProfileSchema.index({ 'projectCapacity.operationalRegions.city': 1, 'projectCapacity.operationalRegions.state': 1 });
constructionProfileSchema.index({ 'projectCapacity.simultaneousProjects.current': 1 });
constructionProfileSchema.index({ 'projectCapacity.projectSizeRange.minSquareFeet': 1, 'projectCapacity.projectSizeRange.maxSquareFeet': 1 });    

module.exports = mongoose.model('ConstructionProfile', constructionProfileSchema);
