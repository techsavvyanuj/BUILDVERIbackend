const mongoose = require('mongoose');
const VendorProfile = require('../models/vendor.profile.model');
const { ApiError } = require('../utils/apiError');

class VendorProfileService {
    async createProfile(userId, profileData) {
        // Check if profile already exists
        const existingProfile = await VendorProfile.findOne({ user: userId });
        if (existingProfile) {
            throw new ApiError(400, 'Vendor profile already exists');
        }

        // Create new profile with default active status and verification
        const profile = new VendorProfile({
            user: userId,
            ...profileData,
            isVerified: true,  // Set verified by default
            status: 'active',  // Set active by default
            ratings: {
                average: 4.0,
                count: 0
            }
        });

        return await profile.save();
    }

    async updateProfile(userId, updateData) {
        const profile = await VendorProfile.findOneAndUpdate(
            { user: userId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!profile) {
            throw new ApiError(404, 'Vendor profile not found');
        }

        return profile;
    }

    async getProfileById(profileId) {
        const profile = await VendorProfile.findById(profileId)
            .populate('user', 'firstName lastName email');

        if (!profile) {
            throw new ApiError(404, 'Vendor profile not found');
        }

        return profile;
    }

    async getProfileByUserId(userId) {
        console.log('Looking for vendor profile with userId:', userId);
        
        // First verify the user ID is valid
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError(400, 'Invalid user ID format');
        }

        // Convert to ObjectId
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // Find the profile
        const profile = await VendorProfile.findOne({ user: userObjectId });
        console.log('Found vendor profile:', profile);

        if (!profile) {
            throw new ApiError(404, 'Vendor profile not found. Please create a profile first.');
        }

        return profile;
    }

    async getAllVendors(page = 1, limit = 10, sortBy = 'ratings.average', order = 'desc', excludeUserId = null) {
        const skip = (page - 1) * limit;
        const sortOptions = {};
        sortOptions[sortBy] = order === 'desc' ? -1 : 1;

        // Build query to exclude current vendor if provided
        const query = { status: 'active' };
        if (excludeUserId) {
            query.user = { $ne: excludeUserId };
        }

        const [vendors, total] = await Promise.all([
            VendorProfile.find(query)
                .populate('user', 'firstName lastName')
                .sort(sortOptions)
                .skip(skip)
                .limit(limit),
            VendorProfile.countDocuments(query)
        ]);

        return {
            vendors,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasMore: page * limit < total
            }
        };
    }

    async searchVendors(criteria, page = 1, limit = 10, excludeUserId = null) {
        const query = { status: 'active' };

        // Exclude current vendor if provided
        if (excludeUserId) {
            query.user = { $ne: excludeUserId };
        }

        if (criteria.city) {
            query['location.city'] = new RegExp(criteria.city, 'i');
        }
        if (criteria.state) {
            query['location.state'] = new RegExp(criteria.state, 'i');
        }
        if (criteria.services) {
            query.services = { $in: criteria.services };
        }
        if (criteria.minExperience) {
            query['experience.yearsInBusiness'] = { $gte: criteria.minExperience };
        }
        if (criteria.minRating) {
            query['ratings.average'] = { $gte: criteria.minRating };
        }

        const skip = (page - 1) * limit;

        const [vendors, total] = await Promise.all([
            VendorProfile.find(query)
                .populate('user', 'firstName lastName')
                .sort({ 'ratings.average': -1, 'experience.yearsInBusiness': -1 })
                .skip(skip)
                .limit(limit),
            VendorProfile.countDocuments(query)
        ]);

        return {
            vendors,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasMore: page * limit < total
            }
        };
    }

    async deleteProfile(userId) {
        const profile = await VendorProfile.findOneAndDelete({ user: userId });
        
        if (!profile) {
            throw new ApiError(404, 'Vendor profile not found');
        }

        return profile;
    }

    async softDeleteProfile(userId) {
        const profile = await VendorProfile.findOneAndUpdate(
            { user: userId },
            { $set: { status: 'inactive' } },
            { new: true }
        );

        if (!profile) {
            throw new ApiError(404, 'Vendor profile not found');
        }

        return profile;
    }
}

module.exports = new VendorProfileService();
