const mongoose = require('mongoose');

const clientProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    activeProjects: [{
        name: {
            type: String,
            required: [true, 'Project name is required'],
            trim: true
        },
        status: {
            type: String,
            enum: ['planning', 'in_progress', 'completed'],
            default: 'planning'
        },
        description: {
            type: String,
            trim: true
        }
    }],
    photos: [{
        url: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('ClientProfile', clientProfileSchema);