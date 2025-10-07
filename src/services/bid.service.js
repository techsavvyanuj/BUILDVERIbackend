const mongoose = require('mongoose');
const Bid = require('../models/bid.model');
const Project = require('../models/project.model');
const VendorProfile = require('../models/vendor.profile.model');
const { ApiError } = require('../utils/apiError');

class BidService {
    constructor() {
        // Cache for frequently accessed bids
        this.bidCache = new Map();
        this.BID_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.MAX_CACHE_SIZE = 1000;
        this.cache = new Map(); // Simple in-memory cache for project bids
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
            console.log('Submitting bid with vendorId:', vendorId);
            
            // First check if vendor profile exists
            const vendor = await VendorProfile.findOne({ user: vendorId });
            console.log('Found vendor profile:', vendor);

            // Then check project
            const project = await Project.findById(projectId);
            console.log('Found project:', project);

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

            // Check if vendor already has a bid
            const existingBid = await Bid.findOne({ project: projectId, vendor: vendor._id });
            if (existingBid) {
                throw new ApiError(400, 'Vendor has already submitted a bid for this project');
            }

            // Validate vendor eligibility
            await this._validateVendorEligibility(vendor, project);

            // Create simplified bid data
            const simplifiedBidData = {
                project: projectId,
                vendor: vendor._id, // Use vendor profile ID, not user ID
                proposedCost: {
                    total: bidData.proposedCost,
                    currency: 'INR',
                    breakdown: [
                        {
                            category: 'labor',
                            description: 'Labor costs',
                            amount: bidData.proposedCost * 0.6,
                            quantity: bidData.teamSize
                        },
                        {
                            category: 'materials',
                            description: 'Materials and supplies',
                            amount: bidData.proposedCost * 0.3
                        },
                        {
                            category: 'overhead',
                            description: 'Overhead and profit',
                            amount: bidData.proposedCost * 0.1
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
                            expectedCompletionDate: new Date(new Date(bidData.startDate).getTime() + (bidData.duration * 30 * 24 * 60 * 60 * 1000 * 0.3)),
                            paymentPercentage: 30
                        },
                        {
                            title: 'Structure Complete',
                            expectedCompletionDate: new Date(new Date(bidData.startDate).getTime() + (bidData.duration * 30 * 24 * 60 * 60 * 1000 * 0.7)),
                            paymentPercentage: 40
                        },
                        {
                            title: 'Project Complete',
                            expectedCompletionDate: new Date(new Date(bidData.startDate).getTime() + (bidData.duration * 30 * 24 * 60 * 60 * 1000)),
                            paymentPercentage: 30
                        }
                    ]
                },
                proposal: {
                    summary: bidData.proposal,
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
                            count: Math.max(1, Math.ceil(bidData.teamSize / 5)),
                            expertise: ['construction', 'supervision'],
                            availability: 'full_time'
                        },
                        {
                            role: 'labor',
                            count: Math.max(1, bidData.teamSize - Math.ceil(bidData.teamSize / 5) - 1),
                            expertise: ['construction'],
                            availability: 'full_time'
                        }
                    ],
                    projectManager: {
                        name: 'Project Manager',
                        experience: 5,
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
            console.log('Creating bid with data:', simplifiedBidData);

            await bid.save({ session });
            console.log('Bid created successfully:', bid._id);

            // Note: Project status remains OPEN to allow multiple vendors to bid
            // Status will only change to IN_REVIEW when client starts reviewing bids

            await session.commitTransaction();

            // Cache the new bid
            this._cacheBid(bid);

            return bid;
        } catch (error) {
            await session.abortTransaction();
            if (error instanceof ApiError) throw error;
            if (error.name === 'ValidationError') {
                throw new ApiError(400, 'Invalid bid data', error.errors);
            }
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
            const bid = await this._getBidAndVerifyOwner(bidId, vendorId);

            // Validate bid is updateable
            if (!['DRAFT', 'PENDING'].includes(bid.status.current)) {
                throw new ApiError(400, 'Cannot update bid in current status');
            }

            // Remove immutable fields
            const sanitizedUpdate = this._sanitizeUpdateData(updateData);

            // Update bid
            Object.assign(bid, sanitizedUpdate);
            await bid.save();

            // Update cache
            this._cacheBid(bid);

            return bid;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            if (error.name === 'ValidationError') {
                throw new ApiError(400, 'Invalid update data', error.errors);
            }
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
            console.log('Selecting bid with:', { bidId, projectId, clientId });
            
            // First get the client profile
            const ClientProfile = mongoose.model('ClientProfile');
            const clientProfile = await ClientProfile.findOne({ user: clientId });
            
            if (!clientProfile) {
                throw new ApiError(404, 'Client profile not found');
            }
            
            console.log('Found client profile:', clientProfile);
            
            // Verify ownership and status
            const [bid, project] = await Promise.all([
                Bid.findById(bidId),
                Project.findOne({ _id: projectId, client: clientProfile._id })
            ]);
            
            console.log('Found bid:', bid);
            console.log('Found project:', project);

            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }
            if (!project) {
                throw new ApiError(404, 'Project not found or unauthorized');
            }

            // Validate statuses
            if (bid.status.current === 'ACCEPTED') {
                // If bid is already accepted, just return the current state
                return {
                    bid: await Bid.findById(bid._id)
                        .populate('vendor', 'companyName location experience ratings')
                        .lean(),
                    project: await Project.findById(project._id)
                        .populate('client', 'name')
                        .lean()
                };
            }

            if (bid.status.current !== 'PENDING' && bid.status.current !== 'IN_REVIEW') {
                throw new ApiError(400, 'Bid cannot be selected in current status');
            }
            
            if (project.status.current !== 'OPEN' && project.status.current !== 'IN_REVIEW') {
                throw new ApiError(400, 'Project must be open or in review to select bids');
            }

            try {
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

                // Commit transaction
                await session.commitTransaction();

                // Clear related caches
                this._clearBidCaches(bidId);
                this._clearProjectBidCaches(projectId);

                // Refresh the bid and project data after transaction
                const updatedBid = await Bid.findById(bid._id)
                    .populate('vendor', 'companyName location experience ratings')
                    .lean();
                    
                const updatedProject = await Project.findById(project._id)
                    .populate('client', 'name')
                    .lean();

                return { bid: updatedBid, project: updatedProject };
            } catch (error) {
                await session.abortTransaction();
                throw error;
            }

            return { bid, project };
        } catch (error) {
            await session.abortTransaction();
            console.error('Error in selectBid:', error);
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
            console.log('Rejecting bid with:', { bidId, projectId, clientId, reason });
            
            // First get the client profile
            const ClientProfile = mongoose.model('ClientProfile');
            const clientProfile = await ClientProfile.findOne({ user: clientId });
            
            if (!clientProfile) {
                throw new ApiError(404, 'Client profile not found');
            }
            
            // Verify ownership and get bid
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

            // Validate status
            if (bid.status.current === 'REJECTED') {
                return {
                    bid: await Bid.findById(bid._id)
                        .populate('vendor', 'companyName location experience ratings')
                        .lean(),
                    message: 'Bid is already rejected'
                };
            }

            if (bid.status.current === 'ACCEPTED') {
                throw new ApiError(400, 'Cannot reject an accepted bid');
            }

            // Reject the bid
            await bid.updateStatus('REJECTED', reason);

            return {
                bid: await Bid.findById(bid._id)
                    .populate('vendor', 'companyName location experience ratings')
                    .lean(),
                message: 'Bid rejected successfully'
            };
        } catch (error) {
            console.error('Error in rejectBid:', error);
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
            console.log('Getting bid details for:', { bidId, clientId });
            
            // First get the client profile
            const ClientProfile = mongoose.model('ClientProfile');
            const clientProfile = await ClientProfile.findOne({ user: clientId });
            
            if (!clientProfile) {
                throw new ApiError(404, 'Client profile not found');
            }
            
            console.log('Found client profile:', clientProfile._id);
            
            // Get bid first without population to check project ownership
            const bid = await Bid.findById(bidId).lean();
            
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }
            
            console.log('Found bid:', bid._id);
            console.log('Bid project ID:', bid.project);
            
            // Check if the project belongs to this client
            const Project = mongoose.model('Project');
            const project = await Project.findOne({ 
                _id: bid.project, 
                client: clientProfile._id 
            }).lean();
            
            if (!project) {
                console.log('Project not found or not owned by client');
                throw new ApiError(403, 'Unauthorized to view this bid');
            }
            
            console.log('Project ownership verified');
            
            // Now get the full bid details with population
            const populatedBid = await Bid.findById(bidId)
                .populate('vendor', 'companyName location experience ratings phone email')
                .populate('project', 'title description budget location specifications timeline')
                .lean();
            
            console.log('Authorization successful, returning bid details');
            console.log('Populated bid data:', JSON.stringify(populatedBid, null, 2));
            return populatedBid;
        } catch (error) {
            console.error('Error in getBidDetails:', error);
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

            // Validate negotiation is possible in current status
            if (!['PENDING', 'IN_REVIEW'].includes(bid.status.current)) {
                throw new ApiError(400, 'Bid cannot be negotiated in current status');
            }

            // Add negotiation
            const negotiation = await bid.addNegotiation({
                ...negotiationData,
                initiator: initiatorType
            });

            return { bid, negotiation };
        } catch (error) {
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
            const bid = await Bid.findById(bidId);
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }

            const competingBids = await Bid.findCompetingBids(bid.project, bid._id);

            // Calculate statistics
            const stats = this._calculateBidStatistics(bid, competingBids);

            return {
                bid: {
                    cost: bid.proposedCost.total,
                    duration: bid.timeline.estimatedDuration
                },
                market: stats,
                competitiveness: this._calculateCompetitivenessScore(bid, stats)
            };
        } catch (error) {
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
        // Check vendor status
        if (vendor.status !== 'active') {
            throw new ApiError(400, 'Vendor account is not active');
        }

        // Note: Verification requirement removed - unverified vendors can now bid
        // This allows all active vendors to participate in bidding regardless of verification status

        // Check project type matches vendor services (skip if services is ['NA'] or empty)
        if (vendor.services && vendor.services.length > 0 && !vendor.services.includes('NA') && !vendor.services.includes(project.projectType)) {
            throw new ApiError(400, 'Project type does not match vendor services');
        }

        // Check experience requirements
        if (project.preferences?.vendorRequirements?.minExperience > vendor.experience.yearsInBusiness) {
            throw new ApiError(400, 'Vendor does not meet minimum experience requirement');
        }

        // Check rating requirements
        if (project.preferences?.vendorRequirements?.minRating > vendor.ratings.average) {
            throw new ApiError(400, 'Vendor does not meet minimum rating requirement');
        }

        return true;
    }

    /**
     * Get bid and verify owner
     * @private
     */
    async _getBidAndVerifyOwner(bidId, vendorId) {
        // Try cache first
        let bid = this._getCachedBid(bidId);

        if (!bid) {
            bid = await Bid.findById(bidId);
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }
            this._cacheBid(bid);
        }

        if (bid.vendor.toString() !== vendorId.toString()) {
            throw new ApiError(403, 'Not authorized to access this bid');
        }

        return bid;
    }

    /**
     * Sanitize update data
     * @private
     */
    _sanitizeUpdateData(updateData) {
        const immutableFields = ['project', 'vendor', 'metadata', '_id', 'createdAt', 'updatedAt'];
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

        return {
            averageCost: costs.reduce((a, b) => a + b, 0) / costs.length,
            medianCost: costs.sort((a, b) => a - b)[Math.floor(costs.length / 2)],
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
        // Initialize base score
        let score = 100;

        // Cost comparison (40% weight)
        const costDiff = (bid.proposedCost.total - stats.averageCost) / stats.averageCost;
        score -= Math.abs(costDiff) * 40;

        // Duration comparison (30% weight)
        const durationDiff = (bid.timeline.estimatedDuration.value - stats.averageDuration) / stats.averageDuration;
        score -= Math.abs(durationDiff) * 30;

        // Team composition (20% weight)
        const teamScore = this._calculateTeamScore(bid.team);
        score += teamScore * 0.2;

        // Previous work (10% weight)
        const previousWorkScore = this._calculatePreviousWorkScore(bid.previousWork);
        score += previousWorkScore * 0.1;

        // Normalize score between 0 and 100
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate team composition score
     * @private
     */
    _calculateTeamScore(team) {
        // Implementation would be based on specific business rules
        return 80; // Placeholder
    }

    /**
     * Calculate previous work score
     * @private
     */
    _calculatePreviousWorkScore(previousWork) {
        // Implementation would be based on specific business rules
        return 80; // Placeholder
    }

    /**
     * Cache management methods
     * @private
     */
    _getCachedBid(bidId) {
        const cached = this.bidCache.get(bidId);
        if (cached && Date.now() - cached.timestamp < this.BID_CACHE_TTL) {
            return cached.bid;
        }
        this.bidCache.delete(bidId);
        return null;
    }

    _cacheBid(bid) {
        if (this.bidCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.bidCache.keys().next().value;
            this.bidCache.delete(oldestKey);
        }

        this.bidCache.set(bid._id.toString(), {
            bid,
            timestamp: Date.now()
        });
    }

    /**
     * Get all bids for a project (optimized with caching)
     * @param {string} projectId - Project ID
     * @param {string} status - Optional status filter
     * @returns {Promise<Array>} Array of bids
     */
    async getProjectBids(projectId, status) {
        try {
            console.log('Getting bids for project:', projectId);
            
            // Check cache first
            const cacheKey = `project_bids_${projectId}_${status || 'all'}`;
            if (this.cache && this.cache.has(cacheKey)) {
                console.log('Returning cached bids for project:', projectId);
                return this.cache.get(cacheKey);
            }

            // Build query
            const query = { project: projectId };
            if (status) {
                query['status.current'] = status.toUpperCase();
            }
            console.log('Query:', query);

            // Get bids with vendor details in a single optimized query
            const bids = await Bid.find(query)
                .populate({
                    path: 'vendor',
                    select: 'companyName location experience ratings services specializations certifications',
                    model: 'VendorProfile'
                })
                .select('-negotiations -previousWork') // Exclude heavy fields
                .sort('-metadata.submittedAt')
                .lean();
            
            console.log('Retrieved bids:', bids.length);

            // Cache the result for 5 minutes
            if (this.cache) {
                this.cache.set(cacheKey, bids, 300000); // 5 minutes
            }

            return bids;
        } catch (error) {
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
            console.log('Deleting bid with:', { bidId, vendorId });
            
            // First find the vendor profile
            const vendor = await VendorProfile.findOne({ user: vendorId });
            if (!vendor) {
                throw new ApiError(404, 'Vendor profile not found');
            }
            
            // Find the bid and verify ownership
            const bid = await Bid.findById(bidId);
            if (!bid) {
                throw new ApiError(404, 'Bid not found');
            }

            // Verify the bid belongs to the vendor (compare with vendor profile ID)
            if (bid.vendor.toString() !== vendor._id.toString()) {
                throw new ApiError(403, 'Not authorized to delete this bid');
            }

            // Check if bid can be deleted (only pending bids can be deleted)
            const bidStatus = typeof bid.status === 'object' ? bid.status?.current : bid.status;
            if (bidStatus !== 'PENDING') {
                throw new ApiError(400, 'Only pending bids can be deleted');
            }

            // Delete the bid
            await Bid.findByIdAndDelete(bidId);

            // Clear related caches
            this._clearBidCaches(bidId);

            console.log('Bid deleted successfully:', bidId);
            return { success: true, bidId };
        } catch (error) {
            console.error('Error in deleteBid service:', error);
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
            console.log('Getting vendor bids for vendorId:', vendorId);
            
            // First find the vendor profile
            const vendor = await VendorProfile.findOne({ user: vendorId });
            console.log('Found vendor profile:', vendor);
            
            if (!vendor) {
                throw new ApiError(404, 'Vendor profile not found');
            }
            
            // Build query using vendor profile ID
            const query = { vendor: vendor._id };
            if (status) {
                query['status.current'] = status.toUpperCase();
            }
            
            console.log('Query for vendor bids:', query);

            // Get total count
            const total = await Bid.countDocuments(query);
            console.log('Total bids found:', total);

            // Get bids with project details
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
                .select('-negotiations -previousWork') // Exclude heavy fields
                .sort('-metadata.submittedAt')
                .skip((options.page - 1) * options.limit)
                .limit(options.limit)
                .lean();
                
            console.log('Bids found:', bids.length);

            return {
                bids,
                pagination: {
                    page: options.page,
                    limit: options.limit,
                    total,
                    pages: Math.ceil(total / options.limit)
                }
            };
        } catch (error) {
            console.error('Error in getVendorBids service:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error retrieving vendor bids', error);
        }
    }

    /**
     * Clear bid-related caches
     * @private
     */
    _clearBidCaches(bidId) {
        // Clear bid cache
        if (this.bidCache) {
            this.bidCache.delete(bidId);
        }
    }

    /**
     * Clear project bid caches
     * @private
     */
    _clearProjectBidCaches(projectId) {
        // Clear project bids cache
        if (this.cache) {
            const keysToDelete = [];
            for (const key of this.cache.keys()) {
                if (key.includes(`project_bids_${projectId}`)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.cache.delete(key));
        }
    }

    /**
     * Get bids for multiple projects (batch)
     * @param {string[]} projectIds - Array of project IDs
     * @param {string} status - Optional status filter
     * @returns {Promise<Object>} Bids grouped by project ID
     */
    async getMultipleProjectBids(projectIds, status) {
        try {
            console.log('Getting bids for projects:', projectIds.length);
            
            // Build query
            const query = { project: { $in: projectIds } };
            if (status) {
                query['status.current'] = status.toUpperCase();
            }
            
            // Get all bids for these projects
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
            
            console.log('Found bids:', bids.length);
            
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
            
            console.log('Bids grouped by project:', Object.keys(bidsByProject).length);
            
            return {
                bids: bidsByProject,
                total: bids.length
            };
        } catch (error) {
            console.error('Error in getMultipleProjectBids service:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error retrieving multiple project bids', error);
        }
    }
}

module.exports = new BidService();
