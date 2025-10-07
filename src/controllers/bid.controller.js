const bidService = require('../services/bid.service');
const { ApiError } = require('../utils/apiError');
const { ApiResponse } = require('../utils/apiResponse');

class BidController {

    /**
     * Submit a new bid
     */
    async submitBid(req, res, next) {
        try {
            const vendorId = req.user.id; // Changed from _id to id to match JWT token
            const { projectId } = req.params;
            console.log('Submitting bid with:', {
                vendorId,
                projectId,
                user: req.user
            });
            
            const bid = await bidService.submitBid(projectId, vendorId, req.body);
            
            res.status(201).json(new ApiResponse(
                201,
                'Bid submitted successfully',
                bid
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update a bid
     */
    async updateBid(req, res, next) {
        try {
            const vendorId = req.user.id; // JWT token has 'id', not '_id'
            const { bidId } = req.params;
            
            const bid = await bidService.updateBid(bidId, vendorId, req.body);
            
            res.status(200).json(new ApiResponse(
                200,
                'Bid updated successfully',
                bid
            ));
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
            const { status } = req.query;
            
            console.log('Getting bids for project:', projectId, 'with status:', status);
            
            const bids = await bidService.getProjectBids(projectId, status);
            console.log('Controller received bids:', bids);
            
            // Format response
            // Use ApiResponse.success static method
            return ApiResponse.success(
                res,
                {
                    bids: bids || [],
                    total: bids ? bids.length : 0,
                    projectId
                },
                'Project bids retrieved successfully'
            );
        } catch (error) {
            console.error('Error in getProjectBids:', error);
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
                return res.status(400).json({
                    status: 'error',
                    message: 'Project IDs array is required'
                });
            }
            
            console.log('Getting bids for projects:', projectIds.length);
            
            // Use the new service method
            const result = await bidService.getMultipleProjectBids(projectIds, status);
            
            return ApiResponse.success(
                res,
                result,
                'Multiple project bids retrieved successfully'
            );
        } catch (error) {
            console.error('Error in getMultipleProjectBids:', error);
            next(error);
        }
    }

    /**
     * Get vendor's bids
     */
    async getVendorBids(req, res, next) {
        try {
            const vendorId = req.user.id; // JWT token has 'id', not '_id'
            const { status, page = 1, limit = 10 } = req.query;
            
            console.log('getVendorBids controller called with:', {
                vendorId,
                status,
                page,
                limit,
                user: req.user
            });
            
            const bids = await bidService.getVendorBids(
                vendorId,
                status,
                { page: parseInt(page), limit: parseInt(limit) }
            );
            
            console.log('getVendorBids controller returning:', {
                bidsCount: bids.bids?.length || 0,
                total: bids.pagination?.total || 0
            });
            
            res.status(200).json({
                status: 'success',
                message: 'Vendor bids retrieved successfully',
                data: bids
            });
        } catch (error) {
            console.error('getVendorBids controller error:', error);
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
            
            res.status(200).json(new ApiResponse(
                200,
                'Negotiation added successfully',
                result
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Reject a bid
     */
    async rejectBid(req, res, next) {
        try {
            const clientId = req.user.id; // Using id from JWT token
            const { bidId, projectId } = req.params;
            const { reason } = req.body;
            
            console.log('Rejecting bid with:', { clientId, bidId, projectId, reason });
            
            const result = await bidService.rejectBid(bidId, projectId, clientId, reason);
            
            res.status(200).json(new ApiResponse(
                200,
                result.message || 'Bid rejected successfully',
                result.bid
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get detailed bid information
     */
    async getBidDetails(req, res, next) {
        try {
            const clientId = req.user.id; // Using id from JWT token
            const { bidId } = req.params;
            
            console.log('Getting bid details with:', { clientId, bidId });
            
            const bid = await bidService.getBidDetails(bidId, clientId);
            
            console.log('Bid details from service:', bid);
            
            // Use the static method instead of constructor
            return ApiResponse.success(
                res,
                bid,
                'Bid details retrieved successfully'
            );
        } catch (error) {
            console.error('Error in getBidDetails controller:', error);
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
            
            res.status(200).json(new ApiResponse(
                200,
                'Competitive analysis retrieved successfully',
                analysis
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a bid
     */
    async deleteBid(req, res, next) {
        try {
            const vendorId = req.user.id; // JWT token has 'id', not '_id'
            const { bidId } = req.params;
            
            console.log('Deleting bid with:', { bidId, vendorId });
            
            const result = await bidService.deleteBid(bidId, vendorId);
            
            res.status(200).json(new ApiResponse(
                200,
                'Bid deleted successfully',
                result
            ));
        } catch (error) {
            console.error('Error in deleteBid controller:', error);
            next(error);
        }
    }
}

module.exports = new BidController();
