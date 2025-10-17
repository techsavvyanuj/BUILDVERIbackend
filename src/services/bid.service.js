const mongoose = require('mongoose');
const Bid = require('../models/bid.model');
const Project = require('../models/project.model');
const VendorProfile = require('../models/vendor.profile.model');
const { ApiError } = require('../utils/apiError');
const logger = require('../utils/logger');

// Constants - Extract magic numbers for maintainability
const BID_CONSTANTS = {
    // Cost breakdown percentages
    COST_BREAKDOWN: {
        LABOR_PERCENTAGE: 0.6,
        MATERIALS_PERCENTAGE: 0.3,
        OVERHEAD_PERCENTAGE: 0.1
    },
    // Milestone percentages
    MILESTONES: {
        FOUNDATION_PERCENTAGE: 0.3,
        FOUNDATION_PAYMENT: 30,
        STRUCTURE_PERCENTAGE: 0.7,
        STRUCTURE_PAYMENT: 40,
        COMPLETION_PAYMENT: 30
    },
    // Team composition ratios
    TEAM: {
        SUPERVISOR_RATIO: 5, // 1 supervisor per 5 team members
        PROJECT_MANAGER_EXPERIENCE: 5
    },
    // Pagination defaults
    PAGINATION: {
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100,
        DEFAULT_PAGE: 1,
        MAX_BATCH_SIZE: 50 // Maximum projects in batch request
    },
    // Cache settings
    CACHE: {
        TTL: 5 * 60 * 1000, // 5 minutes
        MAX_SIZE: 1000,
        CLEANUP_INTERVAL: 60000 // 1 minute
    },
    // Date constants
    TIME: {
        DAYS_IN_MONTH: 30,
        HOURS_IN_DAY: 24,
        MINUTES_IN_HOUR: 60,
        SECONDS_IN_MINUTE: 60,
        MS_IN_SECOND: 1000
    }
};

/**
 * Simple TTL Cache implementation
 * Map doesn't support TTL natively, so we implement it manually
 */
class TTLCache {
    constructor(ttl = BID_CONSTANTS.CACHE.TTL, maxSize = BID_CONSTANTS.CACHE.MAX_SIZE) {
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
    }

    set(key, value) {
        // Evict oldest entry if cache is full
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + this.ttl
        });
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        this.cache.delete(key);
    }

    keys() {
        return this.cache.keys();
    }

    // Clean up expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    get size() {
        return this.cache.size;
    }
}

/**
 * Helper function to sanitize text input (prevent XSS)
 */
function sanitizeText(text) {
    if (!text) return text;
    return text
        .toString()
        .replace(/[<>]/g, '') // Remove < and >
        .trim();
}

/**
 * Helper function to validate pagination parameters
 */
function validatePagination(page, limit) {
    const validatedPage = Math.max(BID_CONSTANTS.PAGINATION.DEFAULT_PAGE, parseInt(page) || BID_CONSTANTS.PAGINATION.DEFAULT_PAGE);
    const validatedLimit = Math.min(
        BID_CONSTANTS.PAGINATION.MAX_LIMIT,
        Math.max(1, parseInt(limit) || BID_CONSTANTS.PAGINATION.DEFAULT_LIMIT)
    );
    return { page: validatedPage, limit: validatedLimit };
}

class BidService {
    constructor() {
        // Cache for frequently accessed bids with proper TTL
        this.bidCache = new TTLCache();
        this.projectBidsCache = new TTLCache();
        
        // Periodic cleanup of expired cache entries
        setInterval(() => {
            this.bidCache.cleanup();
            this.projectBidsCache.cleanup();
        }, BID_CONSTANTS.CACHE.CLEANUP_INTERVAL);
    }

    /**
     * Helper method to get client profile
     * Reduces code duplication
     * @private
     */
    async _getClientProfile(clientId) {
        const ClientProfile = mongoose.model('ClientProfile');
        const clientProfile = await ClientProfile.findOne({ user: clientId }).lean();
        
        if (!clientProfile) {
            throw new ApiError(404, 'Client profile not found');
        }
        
        return clientProfile;
    }

    /**
     * Calculate milestone dates
     * @private
     */
    _calculateMilestoneDates(startDate, durationMonths) {
        const startTime = new Date(startDate).getTime();
        const msInMonth = durationMonths * 
            BID_CONSTANTS.TIME.DAYS_IN_MONTH * 
            BID_CONSTANTS.TIME.HOURS_IN_DAY * 
            BID_CONSTANTS.TIME.MINUTES_IN_HOUR * 
            BID_CONSTANTS.TIME.SECONDS_IN_MINUTE * 
            BID_CONSTANTS.TIME.MS_IN_SECOND;
        
        return {
            foundation: new Date(startTime + msInMonth * BID_CONSTANTS.MILESTONES.FOUNDATION_PERCENTAGE),
            structure: new Date(startTime + msInMonth * BID_CONSTANTS.MILESTONES.STRUCTURE_PERCENTAGE),
            completion: new Date(startTime + msInMonth)
        };
    }

    /**
     * Submit a new bid
     * @param {string} projectId - Project ID
     * @param {string} vendorId - Vendor ID
     * @param {Object} bidData - Bid data
     * @returns {Promise<Object>} Created bid
     */
    async submitBid(projectId, vendorId, bidData) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            logger.debug('Submitting bid', { projectId, vendorId: vendorId.substring(0, 8) });
            
            // Parallel fetch of vendor and project
            const [vendor, project] = await Promise.all([
                VendorProfile.findOne({ user: vendorId }).lean(),
                Project.findById(projectId).lean()
            ]);

            if (!project) {
                throw new ApiError(404, 'Project not found');
            }
            if (!vendor) {
                throw new ApiError(404, 'Vendor not found');
            }

            // Validate project status
            if (!['OPEN', 'IN_REVIEW'].includes(project.status.current)) {
                throw new ApiError(400, 'Project is not open for bidding');
            }

            // Validate vendor eligibility
            await this._validateVendorEligibility(vendor, project);

            // Sanitize text inputs
            const sanitizedProposal = sanitizeText(bidData.proposal);

            // Calculate milestone dates
            const milestoneDates = this._calculateMilestoneDates(bidData.startDate, bidData.duration);
            
            const simplifiedBidData = {
                project: projectId,
                vendor: vendor._id,
                proposedCost: {
                    total: bidData.proposedCost,
                    currency: 'INR',
                    breakdown: [
                        {
                            category: 'labor',
                            description: 'Labor costs',
                            amount: bidData.proposedCost * BID_CONSTANTS.COST_BREAKDOWN.LABOR_PERCENTAGE,
                            quantity: bidData.teamSize
                        },
                        {
                            category: 'materials',
                            description: 'Materials and supplies',
                            amount: bidData.proposedCost * BID_CONSTANTS.COST_BREAKDOWN.MATERIALS_PERCENTAGE
                        },
                        {
                            category: 'overhead',
                            description: 'Overhead and profit',
                            amount: bidData.proposedCost * BID_CONSTANTS.COST_BREAKDOWN.OVERHEAD_PERCENTAGE
                        }
                    ]
                },
                timeline: {
                    proposedStartDate: new Date(bidData.startDate),
                    estimatedDuration: {
                        value: bidData.duration,
                        unit: 'months'
                    },
                    milestones: [
                        {
                            title: 'Foundation Complete',
                            expectedCompletionDate: milestoneDates.foundation,
                            paymentPercentage: BID_CONSTANTS.MILESTONES.FOUNDATION_PAYMENT
                        },
                        {
                            title: 'Structure Complete',
                            expectedCompletionDate: milestoneDates.structure,
                            paymentPercentage: BID_CONSTANTS.MILESTONES.STRUCTURE_PAYMENT
                        },
                        {
                            title: 'Project Complete',
                            expectedCompletionDate: milestoneDates.completion,
                            paymentPercentage: BID_CONSTANTS.MILESTONES.COMPLETION_PAYMENT
                        }
                    ]
                },
                proposal: {
                    summary: sanitizedProposal,
                    approach: 'We will follow industry best practices and ensure quality workmanship throughout the project.',
                    uniqueValue: 'Experienced team with proven track record',
                    risks: []
                },
                team: {
                    composition: [
                        {
                            role: 'project_manager',
                            count: 1,
                            expertise: ['construction', 'management'],
                            availability: 'full_time'
                        },
                        {
                            role: 'supervisor',
                            count: Math.max(1, Math.ceil(bidData.teamSize / BID_CONSTANTS.TEAM.SUPERVISOR_RATIO)),
                            expertise: ['construction', 'supervision'],
                            availability: 'full_time'
                        },
                        {
                            role: 'labor',
                            count: Math.max(1, bidData.teamSize - Math.ceil(bidData.teamSize / BID_CONSTANTS.TEAM.SUPERVISOR_RATIO) - 1),
                            expertise: ['construction'],
                            availability: 'full_time'
                        }
                    ],
                    projectManager: {
                        name: 'Project Manager',
                        experience: BID_CONSTANTS.TEAM.PROJECT_MANAGER_EXPERIENCE,
                        certifications: ['Construction Management']
                    }
                },
                previousWork: [],
                status: {
                    current: 'PENDING',
                    history: [{
                        status: 'PENDING',
                        timestamp: new Date()
                    }]
                }
            };

            // Create and save bid
            const bid = new Bid(simplifiedBidData);
            await bid.save({ session });

            await session.commitTransaction();

            logger.info('Bid created successfully', { bidId: bid._id.toString() });

            // Return lean object
            return bid.toObject();
        } catch (error) {
            await session.abortTransaction();
            if (error instanceof ApiError) throw error;
            
            // Handle duplicate bid error from unique index
            if (error.code === 11000 || error.name === 'MongoServerError') {
                throw new ApiError(400, 'Vendor has already submitted a bid for this project');
            }
            
            if (error.name === 'ValidationError') {
                throw new ApiError(400, 'Invalid bid data', error.errors);
            }
            
            logger.error('Error submitting bid', { error: error.message });
            throw new ApiError(500, 'Error submitting bid', error);
        } finally {
            session.endSession();
        }
    }


    /**
     * Update an existing bid
     * @param {string} bidId - Bid ID
     * @param {string} vendorId - Vendor ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated bid
     */
    async updateBid(bidId, vendorId, updateData) {
        try {
            // Always fetch fresh from DB for updates
            const [vendor, bid] = await Promise.all([
                VendorProfile.findOne({ user: vendorId }).lean(),
                Bid.findById(bidId)
            ]);

            if (!vendor) {
                throw new ApiError(404, 'Vendor profile not found');
            }
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }

            // Verify ownership
            const bidVendorId = bid.vendor._id || bid.vendor;
            if (bidVendorId.toString() !== vendor._id.toString()) {
                throw new ApiError(403, 'Not authorized to access this bid');
            }

            // Validate bid is updateable
            if (!['DRAFT', 'PENDING'].includes(bid.status.current)) {
                throw new ApiError(400, 'Cannot update bid in current status');
            }

            // Sanitize text inputs
            if (updateData.proposal) {
                updateData.proposal = sanitizeText(updateData.proposal);
            }

            // Remove immutable fields
            const sanitized = this._sanitizeUpdateData(updateData);

            // Update bid
            Object.assign(bid, sanitized);
            await bid.save();

            logger.info('Bid updated successfully', { bidId: bid._id.toString() });

            return bid.toObject();
        } catch (error) {
            if (error instanceof ApiError) throw error;
            if (error.name === 'ValidationError') {
                throw new ApiError(400, 'Invalid update data', error.errors);
            }
            logger.error('Error updating bid', { error: error.message });
            throw new ApiError(500, 'Error updating bid', error);
        }
    }

    /**
     * Process bid selection
     * @param {string} bidId - Bid ID
     * @param {string} projectId - Project ID
     * @param {string} clientId - Client ID
     * @returns {Promise<Object>} Updated bid and project
     */
    async selectBid(bidId, projectId, clientId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            logger.debug('Selecting bid', { bidId, projectId });
            
            // Get client profile
            const clientProfile = await this._getClientProfile(clientId);
            
            // Verify ownership and status
            const [bid, project] = await Promise.all([
                Bid.findById(bidId),
                Project.findOne({ _id: projectId, client: clientProfile._id })
            ]);

            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }
            if (!project) {
                throw new ApiError(404, 'Project not found or unauthorized');
            }

            // Idempotent check - if already accepted, return without re-querying
            if (bid.status.current === 'ACCEPTED') {
                await session.abortTransaction();
                // Populate and return existing docs
                await Promise.all([
                    bid.populate('vendor', 'companyName location experience ratings'),
                    project.populate('client', 'name')
                ]);
                return {
                    bid: bid.toObject(),
                    project: project.toObject()
                };
            }

            if (bid.status.current !== 'PENDING' && bid.status.current !== 'IN_REVIEW') {
                throw new ApiError(400, 'Bid cannot be selected in current status');
            }
            
            if (project.status.current !== 'OPEN' && project.status.current !== 'IN_REVIEW') {
                throw new ApiError(400, 'Project must be open or in review to select bids');
            }

            // First move to IN_REVIEW if not already
            if (bid.status.current === 'PENDING') {
                await bid.updateStatus('IN_REVIEW', 'Bid under final review');
            }
            
            // Then accept the bid
            await bid.updateStatus('ACCEPTED', 'Selected by client');

            // Reject other bids
            await Bid.updateMany(
                {
                    project: projectId,
                    _id: { $ne: bidId },
                    'status.current': { $in: ['PENDING', 'IN_REVIEW'] }
                },
                {
                    $set: { 'status.current': 'REJECTED' },
                    $push: {
                        'status.history': {
                            status: 'REJECTED',
                            timestamp: new Date(),
                            reason: 'Another bid was selected'
                        }
                    }
                },
                { session }
            );

            // Update project status
            project.status.current = 'IN_PROGRESS';
            project.status.history.push({
                status: 'IN_PROGRESS',
                timestamp: new Date(),
                reason: 'Bid selected and accepted'
            });

            await project.save({ session });
            await session.commitTransaction();

            // Clear related caches
            this._clearProjectBidCaches(projectId);

            // Populate existing documents
            await Promise.all([
                bid.populate('vendor', 'companyName location experience ratings'),
                project.populate('client', 'name')
            ]);

            logger.info('Bid selected successfully', { bidId: bid._id.toString(), projectId });

            return { 
                bid: bid.toObject(), 
                project: project.toObject() 
            };
        } catch (error) {
            await session.abortTransaction();
            logger.error('Error selecting bid', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error selecting bid', error);
        } finally {
            session.endSession();
        }
    }

    /**
     * Reject a bid
     * @param {string} bidId - Bid ID
     * @param {string} projectId - Project ID
     * @param {string} clientId - Client ID
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated bid
     */
    async rejectBid(bidId, projectId, clientId, reason = 'Bid rejected by client') {
        try {
            logger.debug('Rejecting bid', { bidId, projectId });
            
            // Sanitize reason
            const sanitizedReason = sanitizeText(reason);
            
            // Get client profile
            const clientProfile = await this._getClientProfile(clientId);
            
            // Verify ownership and get bid (single query with populate)
            const [bid, project] = await Promise.all([
                Bid.findById(bidId),
                Project.findOne({ _id: projectId, client: clientProfile._id }).lean()
            ]);
            
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }
            if (!project) {
                throw new ApiError(404, 'Project not found or unauthorized');
            }

            // Idempotent check
            if (bid.status.current === 'REJECTED') {
                await bid.populate('vendor', 'companyName location experience ratings');
                return {
                    bid: bid.toObject(),
                    message: 'Bid is already rejected'
                };
            }

            if (bid.status.current === 'ACCEPTED') {
                throw new ApiError(400, 'Cannot reject an accepted bid');
            }

            // Reject the bid
            await bid.updateStatus('REJECTED', sanitizedReason);
            await bid.populate('vendor', 'companyName location experience ratings');

            logger.info('Bid rejected successfully', { bidId: bid._id.toString() });

            return {
                bid: bid.toObject(),
                message: 'Bid rejected successfully'
            };
        } catch (error) {
            logger.error('Error rejecting bid', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error rejecting bid', error);
        }
    }

    /**
     * Get detailed bid information
     * @param {string} bidId - Bid ID
     * @param {string} clientId - Client ID (for authorization)
     * @returns {Promise<Object>} Detailed bid information
     */
    async getBidDetails(bidId, clientId) {
        try {
            logger.debug('Getting bid details', { bidId });
            
            // Get client profile
            const clientProfile = await this._getClientProfile(clientId);
            
            // ⚡ OPTIMIZED: Single query to get bid with project field
            const bidWithProject = await Bid.findById(bidId).select('project').lean();
            
            if (!bidWithProject) {
                throw new ApiError(404, 'Bid not found');
            }
            
            // Verify project ownership (parallel with full bid fetch)
            const [project, populatedBid] = await Promise.all([
                Project.findOne({ _id: bidWithProject.project, client: clientProfile._id }).lean(),
                Bid.findById(bidId)
                    .populate('vendor', 'companyName location experience ratings phone email')
                    .populate('project', 'title description budget location specifications timeline')
                    .lean()
            ]);
            
            if (!project) {
                throw new ApiError(403, 'Unauthorized to view this bid');
            }
            
            logger.debug('Bid details retrieved successfully');
            return populatedBid;
        } catch (error) {
            logger.error('Error getting bid details', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error getting bid details', error);
        }
    }

    /**
     * Handle bid negotiation
     * @param {string} bidId - Bid ID
     * @param {Object} negotiationData - Negotiation data
     * @param {string} initiatorType - Type of initiator (client/vendor)
     * @returns {Promise<Object>} Updated bid with negotiation
     */
    async negotiateBid(bidId, negotiationData, initiatorType) {
        try {
            const bid = await Bid.findById(bidId);
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }

            if (!['PENDING', 'IN_REVIEW'].includes(bid.status.current)) {
                throw new ApiError(400, 'Bid cannot be negotiated in current status');
            }

            // Sanitize message
            if (negotiationData.message) {
                negotiationData.message = sanitizeText(negotiationData.message);
            }

            const negotiation = await bid.addNegotiation({
                ...negotiationData,
                initiator: initiatorType
            });

            logger.info('Negotiation added successfully', { bidId: bid._id.toString() });
            return { bid: bid.toObject(), negotiation };
        } catch (error) {
            logger.error('Error processing negotiation', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error processing negotiation', error);
        }
    }

    /**
     * Get competitive analysis for a bid
     * @param {string} bidId - Bid ID
     * @returns {Promise<Object>} Competitive analysis
     */
    async getCompetitiveAnalysis(bidId) {
        try {
            // ⚡ OPTIMIZED: Cache competitive analysis (computationally expensive)
            const cacheKey = `competitive_analysis_${bidId}`;
            const cached = this.bidCache.get(cacheKey);
            if (cached) {
                logger.debug('Returning cached competitive analysis');
                return cached;
            }

            const bid = await Bid.findById(bidId).lean();
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }

            const competingBids = await Bid.findCompetingBids(bid.project, bid._id);
            const stats = this._calculateBidStatistics(bid, competingBids);

            const analysis = {
                bid: {
                    cost: bid.proposedCost.total,
                    duration: bid.timeline.estimatedDuration
                },
                market: stats,
                competitiveness: this._calculateCompetitivenessScore(bid, stats)
            };

            // Cache the result
            this.bidCache.set(cacheKey, analysis);

            return analysis;
        } catch (error) {
            logger.error('Error generating competitive analysis', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error generating competitive analysis', error);
        }
    }

    // Private helper methods

    /**
     * Validate vendor eligibility for project
     * @private
     */
    async _validateVendorEligibility(vendor, project) {
        if (vendor.status !== 'active') {
            throw new ApiError(400, 'Vendor account is not active');
        }

        if (vendor.services && vendor.services.length > 0 && 
            !vendor.services.includes('NA') && 
            !vendor.services.includes(project.projectType)) {
            throw new ApiError(400, 'Project type does not match vendor services');
        }

        if (project.preferences?.vendorRequirements?.minExperience > vendor.experience.yearsInBusiness) {
            throw new ApiError(400, 'Vendor does not meet minimum experience requirement');
        }

        if (project.preferences?.vendorRequirements?.minRating > vendor.ratings.average) {
            throw new ApiError(400, 'Vendor does not meet minimum rating requirement');
        }

        return true;
    }

    /**
     * Sanitize update data
     * @private
     */
    _sanitizeUpdateData(updateData) {
        const immutableFields = ['project', 'vendor', 'status', 'metadata', '_id', 'createdAt', 'updatedAt'];
        const sanitized = { ...updateData };
        immutableFields.forEach(field => delete sanitized[field]);
        return sanitized;
    }

    /**
     * Calculate bid statistics
     * @private
     */
    _calculateBidStatistics(bid, competingBids) {
        if (!competingBids.length) {
            return {
                averageCost: bid.proposedCost.total,
                medianCost: bid.proposedCost.total,
                costRange: { min: bid.proposedCost.total, max: bid.proposedCost.total },
                averageDuration: bid.timeline.estimatedDuration.value,
                bidCount: 1
            };
        }

        const costs = competingBids.map(b => b.proposedCost.total);
        const durations = competingBids.map(b => b.timeline.estimatedDuration.value);
        const sortedCosts = [...costs].sort((a, b) => a - b);

        return {
            averageCost: costs.reduce((a, b) => a + b, 0) / costs.length,
            medianCost: sortedCosts[Math.floor(sortedCosts.length / 2)],
            costRange: {
                min: Math.min(...costs),
                max: Math.max(...costs)
            },
            averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            bidCount: competingBids.length + 1
        };
    }

    /**
     * Calculate bid competitiveness score
     * @private
     */
    _calculateCompetitivenessScore(bid, stats) {
        let score = 100;

        const costDiff = (bid.proposedCost.total - stats.averageCost) / stats.averageCost;
        score -= Math.abs(costDiff) * 40;

        const durationDiff = (bid.timeline.estimatedDuration.value - stats.averageDuration) / stats.averageDuration;
        score -= Math.abs(durationDiff) * 30;

        const teamScore = this._calculateTeamScore(bid.team);
        score += teamScore * 0.2;

        const previousWorkScore = this._calculatePreviousWorkScore(bid.previousWork);
        score += previousWorkScore * 0.1;

        return Math.max(0, Math.min(100, score));
    }

    _calculateTeamScore(team) {
        return 80; // Placeholder
    }

    _calculatePreviousWorkScore(previousWork) {
        return 80; // Placeholder
    }

    /**
     * Get all bids for a project (optimized with caching and pagination)
     * @param {string} projectId - Project ID
     * @param {string} status - Optional status filter
     * @param {Object} options - Pagination options { page, limit }
     * @returns {Promise<Object>} Object with bids array and pagination metadata
     */
    async getProjectBids(projectId, status, options = {}) {
        try {
            logger.debug('Getting bids for project', { projectId });
            
            // Validate and sanitize pagination
            const { page, limit } = validatePagination(options.page, options.limit);
            const skip = (page - 1) * limit;
            
            // Check cache
            const cacheKey = `project_bids_${projectId}_${status || 'all'}_${page}_${limit}`;
            const cached = this.projectBidsCache.get(cacheKey);
            if (cached) {
                logger.debug('Returning cached bids');
                return cached;
            }

            // Build query
            const query = { project: projectId };
            if (status) {
                query['status.current'] = status.toUpperCase();
            }

            // Use aggregation for count + find in one operation
            const [result] = await Bid.aggregate([
                { $match: query },
                {
                    $facet: {
                        metadata: [{ $count: 'total' }],
                        data: [
                            { $sort: { 'metadata.submittedAt': -1 } },
                            { $skip: skip },
                            { $limit: limit }
                        ]
                    }
                }
            ]);

            const total = result.metadata[0]?.total || 0;
            const bidIds = result.data.map(b => b._id);

            // Populate vendor details for fetched bids
            const bids = await Bid.find({ _id: { $in: bidIds } })
                .populate({
                    path: 'vendor',
                    select: 'companyName location experience ratings services specializations certifications',
                    model: 'VendorProfile'
                })
                .select('-negotiations -previousWork')
                .sort('-metadata.submittedAt')
                .lean();

            const response = {
                bids,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                    hasMore: skip + bids.length < total
                }
            };

            // Cache the result
            this.projectBidsCache.set(cacheKey, response);

            return response;
        } catch (error) {
            logger.error('Error retrieving project bids', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error retrieving project bids', error);
        }
    }

    /**
     * Delete a bid
     * @param {string} bidId - Bid ID
     * @param {string} vendorId - Vendor ID (for authorization)
     * @returns {Promise<Object>} Deletion result
     */
    async deleteBid(bidId, vendorId) {
        try {
            logger.debug('Deleting bid', { bidId });
            
            const [vendor, bid] = await Promise.all([
                VendorProfile.findOne({ user: vendorId }).lean(),
                Bid.findById(bidId).lean()
            ]);

            if (!vendor) {
                throw new ApiError(404, 'Vendor profile not found');
            }
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }

            if (bid.vendor.toString() !== vendor._id.toString()) {
                throw new ApiError(403, 'Not authorized to delete this bid');
            }

            const bidStatus = bid.status?.current || bid.status;
            if (bidStatus !== 'PENDING') {
                throw new ApiError(400, 'Only pending bids can be deleted');
            }

            await Bid.findByIdAndDelete(bidId);
            this._clearProjectBidCaches(bid.project.toString());

            logger.info('Bid deleted successfully', { bidId });
            return { success: true, bidId };
        } catch (error) {
            logger.error('Error deleting bid', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error deleting bid', error);
        }
    }

    /**
     * Get all bids for a vendor
     * @param {string} vendorId - Vendor ID
     * @param {string} status - Optional status filter
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Vendor's bids with pagination
     */
    async getVendorBids(vendorId, status, options = {}) {
        try {
            logger.debug('Getting vendor bids', { vendorId: vendorId.substring(0, 8) });
            
            // Validate pagination
            const { page, limit } = validatePagination(options.page, options.limit);
            
            const vendor = await VendorProfile.findOne({ user: vendorId }).lean();
            if (!vendor) {
                throw new ApiError(404, 'Vendor profile not found');
            }
            
            const query = { vendor: vendor._id };
            if (status) {
                query['status.current'] = status.toUpperCase();
            }

            // Use aggregation for count + find
            const [result] = await Bid.aggregate([
                { $match: query },
                {
                    $facet: {
                        metadata: [{ $count: 'total' }],
                        data: [
                            { $sort: { 'metadata.submittedAt': -1 } },
                            { $skip: (page - 1) * limit },
                            { $limit: limit }
                        ]
                    }
                }
            ]);

            const total = result.metadata[0]?.total || 0;
            const bidIds = result.data.map(b => b._id);

            const bids = await Bid.find({ _id: { $in: bidIds } })
                .populate({
                    path: 'project',
                    select: 'title description location projectType budget timeline client',
                    populate: {
                        path: 'client',
                        select: 'name email phone',
                        model: 'ClientProfile'
                    }
                })
                .select('-negotiations -previousWork')
                .sort('-metadata.submittedAt')
                .lean();

            return {
                bids,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error retrieving vendor bids', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error retrieving vendor bids', error);
        }
    }

    /**
     * Clear project bid caches
     * @private
     */
    _clearProjectBidCaches(projectId) {
        // Clear project bids cache
        const projectBidKeys = [];
        for (const key of this.projectBidsCache.keys()) {
            if (key.includes(`project_bids_${projectId}`)) {
                projectBidKeys.push(key);
            }
        }
        projectBidKeys.forEach(key => this.projectBidsCache.delete(key));

        // ⚡ OPTIMIZED: Also clear competitive analysis cache for bids in this project
        const analysisKeys = [];
        for (const key of this.bidCache.keys()) {
            if (key.includes('competitive_analysis_')) {
                analysisKeys.push(key);
            }
        }
        analysisKeys.forEach(key => this.bidCache.delete(key));
    }

    /**
     * Get bids for multiple projects (batch)
     * @param {string[]} projectIds - Array of project IDs
     * @param {string} status - Optional status filter
     * @returns {Promise<Object>} Bids grouped by project ID
     */
    async getMultipleProjectBids(projectIds, status) {
        try {
            // Validate batch size
            if (projectIds.length > BID_CONSTANTS.PAGINATION.MAX_BATCH_SIZE) {
                throw new ApiError(400, `Cannot request more than ${BID_CONSTANTS.PAGINATION.MAX_BATCH_SIZE} projects at once`);
            }

            logger.debug('Getting bids for multiple projects', { count: projectIds.length });
            
            const query = { project: { $in: projectIds } };
            if (status) {
                query['status.current'] = status.toUpperCase();
            }
            
            const bids = await Bid.find(query)
                .populate({
                    path: 'project',
                    select: 'title description location projectType budget timeline client',
                    populate: {
                        path: 'client',
                        select: 'name email phone',
                        model: 'ClientProfile'
                    }
                })
                .populate('vendor', 'companyName user')
                .select('-negotiations -previousWork')
                .sort('-metadata.submittedAt')
                .lean();
            
            // Group bids by project ID
            const bidsByProject = {};
            projectIds.forEach(projectId => {
                bidsByProject[projectId] = [];
            });
            
            bids.forEach(bid => {
                const projectId = bid.project._id.toString();
                if (bidsByProject[projectId]) {
                    bidsByProject[projectId].push(bid);
                }
            });
            
            return {
                bids: bidsByProject,
                total: bids.length
            };
        } catch (error) {
            logger.error('Error retrieving multiple project bids', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error retrieving multiple project bids', error);
        }
    }
}

module.exports = new BidService();
