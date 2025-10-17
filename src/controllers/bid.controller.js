const bidService = require('../services/bid.service');
const { ApiError } = require('../utils/apiError');
const { ApiResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

class BidController {

    /**
     * Submit a new bid
     */
    async submitBid(req, res, next) {
        try {
            const vendorId = req.user.id;
            const { projectId } = req.params;
            
            const bid = await bidService.submitBid(projectId, vendorId, req.body);
            
            return ApiResponse.created(res, bid, 'Bid submitted successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update a bid
     */
    async updateBid(req, res, next) {
        try {
            const vendorId = req.user.id;
            const { bidId } = req.params;
            
            const bid = await bidService.updateBid(bidId, vendorId, req.body);
            
            return ApiResponse.success(res, bid, 'Bid updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Select a bid
     */
    async selectBid(req, res, next) {
        try {
            const clientId = req.user.id; // Using id from JWT token
            const { bidId, projectId } = req.params;
            
            const result = await bidService.selectBid(bidId, projectId, clientId);
            
            // Format the response
            const response = {
                bid: {
                    _id: result.bid._id,
                    status: result.bid.status,
                    proposedCost: result.bid.proposedCost,
                    timeline: result.bid.timeline,
                    vendor: result.bid.vendor
                },
                project: {
                    _id: result.project._id,
                    title: result.project.title,
                    status: result.project.status,
                    timeline: result.project.timeline
                }
            };

            // Determine message based on bid status
            const message = result.bid.status.current === 'ACCEPTED' 
                ? 'Bid is already accepted'
                : 'Bid selected successfully';
            
            return ApiResponse.success(
                res,
                response,
                message
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get project bids
     */
    async getProjectBids(req, res, next) {
        try {
            const { projectId } = req.params;
            const { status, page = 1, limit = 20 } = req.query;
            
            const result = await bidService.getProjectBids(projectId, status, {
                page: parseInt(page),
                limit: parseInt(limit)
            });
            
            return ApiResponse.success(
                res,
                {
                    ...result,
                    projectId
                },
                'Project bids retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get multiple project bids (batch)
     */
    async getMultipleProjectBids(req, res, next) {
        try {
            const { projectIds, status } = req.body;
            
            if (!projectIds || !Array.isArray(projectIds)) {
                throw new ApiError(400, 'Project IDs array is required');
            }
            
            const result = await bidService.getMultipleProjectBids(projectIds, status);
            
            return ApiResponse.success(
                res,
                result,
                'Multiple project bids retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get vendor's bids
     */
    async getVendorBids(req, res, next) {
        try {
            const vendorId = req.user.id;
            const { status, page = 1, limit = 10 } = req.query;
            
            const bids = await bidService.getVendorBids(
                vendorId,
                status,
                { page: parseInt(page), limit: parseInt(limit) }
            );
            
            return ApiResponse.success(res, bids, 'Vendor bids retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Negotiate bid
     */
    async negotiateBid(req, res, next) {
        try {
            const { bidId } = req.params;
            const initiatorType = req.user.role === 'client_owner' ? 'client' : 'vendor';
            
            const result = await bidService.negotiateBid(
                bidId,
                req.body,
                initiatorType
            );
            
            return ApiResponse.success(res, result, 'Negotiation added successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Reject a bid
     */
    async rejectBid(req, res, next) {
        try {
            const clientId = req.user.id;
            const { bidId, projectId } = req.params;
            const { reason } = req.body;
            
            const result = await bidService.rejectBid(bidId, projectId, clientId, reason);
            
            return ApiResponse.success(
                res,
                result.bid,
                result.message || 'Bid rejected successfully'
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get detailed bid information
     */
    async getBidDetails(req, res, next) {
        try {
            const clientId = req.user.id;
            const { bidId } = req.params;
            
            const bid = await bidService.getBidDetails(bidId, clientId);
            
            return ApiResponse.success(
                res,
                bid,
                'Bid details retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get bid competitive analysis
     */
    async getBidAnalysis(req, res, next) {
        try {
            const { bidId } = req.params;
            
            const analysis = await bidService.getCompetitiveAnalysis(bidId);
            
            return ApiResponse.success(
                res,
                analysis,
                'Competitive analysis retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a bid
     */
    async deleteBid(req, res, next) {
        try {
            const vendorId = req.user.id;
            const { bidId } = req.params;
            
            const result = await bidService.deleteBid(bidId, vendorId);
            
            return ApiResponse.success(res, result, 'Bid deleted successfully');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new BidController();
