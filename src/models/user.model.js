const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters']
    },
    role: {
        type: String,
        enum: ['client_owner', 'vendor_supplier', 'construction_firm'],
        required: [true, 'Role is required']
    },
    phone: {
        type: String,
        required: function() {
            return this.role === 'vendor_supplier' || this.role === 'construction_firm';
        },
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    companyName: {
        type: String,
        required: function() {
            return this.role === 'construction_firm';
        },
        trim: true
    },
    gstNumber: {
        type: String,
        required: function() {
            return this.role === 'construction_firm';
        },
        trim: true,
        match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

// Index for email lookups
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);