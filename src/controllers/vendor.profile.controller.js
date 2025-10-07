const { validationResult } = require('express-validator');
const vendorProfileService = require('../services/vendor.profile.service');
const { ApiResponse } = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');

class VendorProfileController {
    constructor() {
        this.createProfile = this.createProfile.bind(this);
        this.updateProfile = this.updateProfile.bind(this);
        this.getProfile = this.getProfile.bind(this);
        this.getOwnProfile = this.getOwnProfile.bind(this);
        this.getAllVendors = this.getAllVendors.bind(this);
        this.searchVendors = this.searchVendors.bind(this);
        this.deleteProfile = this.deleteProfile.bind(this);
        this.softDeleteProfile = this.softDeleteProfile.bind(this);
    }

    async getOwnProfile(req, res, next) {
        try {
            const profile = await vendorProfileService.getProfileByUserId(req.user.id);
            return ApiResponse.success(res, profile, 'Vendor profile retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async createProfile(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            // Only vendor_supplier role can create profiles
            if (req.user.role !== 'vendor_supplier') {
                throw new ApiError(403, 'Only vendors can create vendor profiles');
            }

            const profile = await vendorProfileService.createProfile(req.user.id, req.body);
            return ApiResponse.success(res, profile, 'Vendor profile created successfully');
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            const profile = await vendorProfileService.updateProfile(req.user.id, req.body);
            return ApiResponse.success(res, profile, 'Vendor profile updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async getProfile(req, res, next) {
        try {
            const profile = await vendorProfileService.getProfileById(req.params.id);
            return ApiResponse.success(res, profile, 'Vendor profile retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getAllVendors(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const sortBy = req.query.sortBy || 'ratings.average';
            const order = req.query.order || 'desc';

            // Pass user ID to exclude current vendor from results
            const excludeUserId = req.user.role === 'vendor_supplier' ? req.user.id : null;
            
            const vendors = await vendorProfileService.getAllVendors(page, limit, sortBy, order, excludeUserId);
            return ApiResponse.success(res, vendors, 'Vendors retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async searchVendors(req, res, next) {
        try {
            const {
                city,
                state,
                services,
                minExperience,
                minRating,
                page = 1,
                limit = 10
            } = req.query;

            const searchCriteria = {
                city,
                state,
                services: services ? services.split(',') : undefined,
                minExperience: minExperience ? parseInt(minExperience) : undefined,
                minRating: minRating ? parseFloat(minRating) : undefined
            };

            // Pass user ID to exclude current vendor from search results
            const excludeUserId = req.user.role === 'vendor_supplier' ? req.user.id : null;

            const results = await vendorProfileService.searchVendors(searchCriteria, page, limit, excludeUserId);
            return ApiResponse.success(res, results, 'Search results retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async deleteProfile(req, res, next) {
        try {
            // Only allow vendors to delete their own profile
            if (req.user.role !== 'vendor_supplier') {
                throw new ApiError(403, 'Only vendors can delete their profiles');
            }

            const profile = await vendorProfileService.deleteProfile(req.user.id);
            return ApiResponse.success(res, profile, 'Vendor profile deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    async softDeleteProfile(req, res, next) {
        try {
            // Only allow vendors to soft delete their own profile
            if (req.user.role !== 'vendor_supplier') {
                throw new ApiError(403, 'Only vendors can deactivate their profiles');
            }

            const profile = await vendorProfileService.softDeleteProfile(req.user.id);
            return ApiResponse.success(res, profile, 'Vendor profile deactivated successfully');
        } catch (error) {
            next(error);
        }
    }

    async getVendorAnalytics(req, res, next) {
        try {
            const vendorId = req.user.id;
            
            // Get vendor profile
            const VendorProfile = require('mongoose').model('VendorProfile');
            const vendorProfile = await VendorProfile.findOne({ user: vendorId });
            
            if (!vendorProfile) {
                return ApiResponse.success(res, {
                    totalProjects: 0,
                    activeProjects: 0,
                    completedProjects: 0,
                    onHoldProjects: 0,
                    totalRevenue: 0,
                    averageRating: 0,
                    totalBids: 0,
                    acceptedBids: 0
                }, 'Vendor analytics retrieved successfully');
            }

            // Get projects where vendor has bid on
            const Project = require('mongoose').model('Project');
            const Bid = require('mongoose').model('Bid');
            
            // First, get all project IDs where this vendor has bid
            const vendorBids = await Bid.find({ 
                vendor: vendorProfile._id 
            }).select('project status.current');
            
            const projectIds = vendorBids.map(bid => bid.project);
            
            // Get projects that the vendor has bid on
            const projects = projectIds.length > 0 ? await Project.find({ 
                _id: { $in: projectIds }
            }) : [];

            // Get vendor's bids
            const bids = await Bid.find({ vendor: vendorProfile._id });

            // Calculate analytics
            const totalProjects = projects.length;
            const activeProjects = projects.filter(p => p.status?.current === 'IN_PROGRESS').length;
            const completedProjects = projects.filter(p => p.status?.current === 'COMPLETED').length;
            const onHoldProjects = projects.filter(p => p.status?.current === 'ON_HOLD').length;
            
            // Calculate revenue from accepted bids
            const acceptedBids = bids.filter(bid => bid.status?.current === 'ACCEPTED');
            const totalRevenue = acceptedBids.reduce((sum, bid) => {
                return sum + (bid.proposedCost?.total || 0);
            }, 0);

            const totalBids = bids.length;
            const acceptedBidsCount = acceptedBids.length;

            const analytics = {
                totalProjects,
                activeProjects,
                completedProjects,
                onHoldProjects,
                totalRevenue,
                averageRating: vendorProfile.rating || 0,
                totalBids,
                acceptedBids: acceptedBidsCount,
                acceptanceRate: totalBids > 0 ? (acceptedBidsCount / totalBids * 100).toFixed(1) : 0
            };

            return ApiResponse.success(res, analytics, 'Vendor analytics retrieved successfully');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new VendorProfileController();
