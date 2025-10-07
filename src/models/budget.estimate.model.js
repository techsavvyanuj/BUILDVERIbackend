const mongoose = require('mongoose');

const budgetEstimateSchema = new mongoose.Schema({
    project_name: {
        type: String,
        required: [true, 'Project name is required'],
        trim: true
    },
    project_type: {
        type: String,
        required: [true, 'Project type is required'],
        enum: [
            'residential',
            'commercial',
            'industrial'
        ]
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
    project_details: {
        area_sqm: {
            type: Number,
            required: [true, 'Area in square meters is required'],
            min: [10, 'Area must be at least 10 square meters']
        },
        floors: {
            type: Number,
            required: [true, 'Number of floors is required'],
            min: [1, 'Must have at least 1 floor']
        },
        quality_level: {
            type: String,
            required: [true, 'Quality level is required'],
            enum: ['standard', 'premium'],
            default: 'standard'
        }
    },
    timeline_months: {
        type: Number,
        required: [true, 'Timeline in months is required'],
        min: [1, 'Timeline must be at least 1 month']
    },
    budget_preference: {
        type: Number,
        required: [true, 'Budget preference is required'],
        min: [100000, 'Budget must be at least 1 lakh INR']
    },
    estimate_result: {
        total_cost: {
            min: {
                type: Number,
                required: false
            },
            max: {
                type: Number,
                required: false
            }
        },
        cost_breakdown: [{
            category: {
                type: String,
                required: false
            },
            amount: {
                min: {
                    type: Number,
                    required: false
                },
                max: {
                    type: Number,
                    required: false
                }
            },
            percentage: {
                type: Number,
                required: false
            },
            details: [{
                _id: false,
                item: {
                    type: String,
                    required: false
                },
                quantity: {
                    type: String,
                    required: false
                },
                unit_cost: {
                    type: Number,
                    required: false
                },
                total_cost: {
                    type: Number,
                    required: false
                }
            }]
        }],
        factors_considered: [{
            _id: false,
            factor: {
                type: String,
                required: false
            },
            impact: {
                type: String,
                required: false
            },
            percentage_effect: {
                type: Number,
                required: false
            }
        }],
        recommendations: [{
            _id: false,
            type: {
                type: String,
                required: false
            },
            description: {
                type: String,
                required: false
            },
            potential_savings: {
                type: Number,
                required: false
            }
        }]
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

// Update timestamp on save
budgetEstimateSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

module.exports = mongoose.model('BudgetEstimate', budgetEstimateSchema);
