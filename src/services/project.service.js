const Project = require('../models/project.model');
const { ApiError } = require('../utils/apiError');
const mongoose = require('mongoose');

class ProjectService {
    /**
     * Create and publish a project in one step
     * @param {string} clientId - The client's ID
     * @param {Object} projectData - The project data
     * @returns {Promise<Object>} Created and published project
     */
    async createAndPublish(clientId, projectData) {
        try {
            // Validate client exists and get profile
            console.log('Searching for client profile with user ID:', clientId);
            const ClientProfile = mongoose.model('ClientProfile');
            const User = mongoose.model('User');

            // First, verify the user exists
            const user = await User.findById(clientId);
            if (!user) {
                throw new ApiError(404, 'User not found');
            }

            // Then find the client profile
            const clientProfile = await ClientProfile.findOne({ user: clientId });
            console.log('Found client profile:', clientProfile);
            
            if (!clientProfile) {
                throw new ApiError(404, 'Client profile not found. Please create your profile first');
            }

            // Create project with initial status
            console.log('Creating project with client profile ID:', clientProfile._id);
            console.log('Project data:', projectData);
            
            // Prepare simplified project data
            const projectDataWithDefaults = {
                client: clientProfile._id,
                title: projectData.title,
                description: projectData.description,
                budget: {
                    range: {
                        min: projectData.budget,
                        max: projectData.budget * 1.2 // Add 20% buffer
                    },
                    currency: 'INR',
                    flexibility: 'flexible'
                },
                location: {
                    address: projectData.location,
                    city: projectData.location.split(',')[0]?.trim() || projectData.location,
                    state: 'Maharashtra', // Default state
                    pincode: '400001' // Default pincode
                },
                projectType: projectData.projectType,
                subType: {
                    residential: projectData.projectType === 'residential' ? 'villa' : undefined,
                    commercial: projectData.projectType === 'commercial' ? 'office' : undefined
                },
                specifications: {
                    area: {
                        value: projectData.area,
                        unit: 'sqft'
                    },
                    floors: 1, // Default to 1 floor
                    requirements: []
                },
                timeline: {
                    expectedStartDate: new Date(projectData.startDate),
                    expectedDuration: {
                        value: projectData.duration,
                        unit: 'months'
                    },
                    preferredWorkingHours: {
                        start: '09:00',
                        end: '18:00'
                    }
                },
                preferences: {
                    vendorRequirements: {
                        minExperience: 0,
                        minRating: 0
                    },
                    communicationPreference: 'both'
                },
                visibility: 'public',
                status: {
                    current: 'OPEN', // Directly set to OPEN for create-and-publish
                    history: [{
                        status: 'OPEN',
                        timestamp: new Date(),
                        reason: 'Project published on creation'
                    }]
                }
            };

            // Create project
            const project = new Project(projectDataWithDefaults);

            console.log('Project model before save:', project);

            try {
                // Save project
                await project.save();
                console.log('Project saved successfully:', project._id);
            } catch (saveError) {
                console.error('Project save error:', saveError);
                if (saveError.code === 16755) {
                    throw new ApiError(400, 'Invalid project structure');
                }
                throw saveError;
            }

            // Cache the new project
            this._cacheProject(project);

            return project;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            if (error.name === 'ValidationError') {
                throw new ApiError(400, 'Invalid project data', error.errors);
            }
            throw new ApiError(500, 'Error creating and publishing project', error);
        }
    }
    constructor() {
        // Cache frequently accessed data
        this.projectCache = new Map();
        this.PROJECT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.MAX_CACHE_SIZE = 1000;
    }

    // Removed createProject method - only using createAndPublish now

    /**
     * Get project by ID
     */
    async getProjectById(projectId) {
        // Try cache first
        let project = this._getCachedProject(projectId);

        if (!project) {
            project = await Project.findById(projectId)
                .populate('client', 'name location');
            
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            this._cacheProject(project);
        }

        return project;
    }

    /**
     * Update a project
     */
    async updateProject(projectId, clientId, updateData) {
        try {
            const project = await Project.findOneAndUpdate(
                { _id: projectId, client: clientId },
                updateData,
                { new: true, runValidators: true }
            );

            if (!project) {
                throw new ApiError(404, 'Project not found or access denied');
            }

            // Clear cache
            this._clearProjectCache(projectId);

            return project;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error updating project', error);
        }
    }

    /**
     * Delete a project
     */
    async deleteProject(projectId, clientId) {
        try {
            console.log('deleteProject service - projectId:', projectId, 'clientId:', clientId);
            
            const project = await Project.findOneAndDelete({
                _id: projectId,
                client: clientId
            });

            if (!project) {
                console.log('Project not found or access denied');
                throw new ApiError(404, 'Project not found or access denied');
            }

            // Also delete all related bids
            const Bid = require('../models/bid.model');
            const deletedBids = await Bid.deleteMany({ project: projectId });
            console.log('Deleted', deletedBids.deletedCount, 'related bids');

            // Clear cache
            this._clearProjectCache(projectId);

            console.log('Project deleted successfully');
            return { message: 'Project deleted successfully' };
        } catch (error) {
            console.error('Error in deleteProject service:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error deleting project', error);
        }
    }

    /**
     * Search for projects based on criteria
     */
    async searchProjects(criteria, options = {}) {
        try {
            const query = this._buildSearchQuery(criteria);
            
            const { page = 1, limit = 10, sort = '-metadata.createdAt' } = options;

            // If vendor and no status specified, default to OPEN projects
            if (criteria.userRole === 'vendor_supplier' && !query['status.current']) {
                query['status.current'] = 'OPEN';
            }

            const [projects, total] = await Promise.all([
                Project.find(query)
                    .sort(sort)
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .populate('client', 'name location')
                    .lean(), // Convert to plain JavaScript objects
                Project.countDocuments(query)
            ]);

            // Format the response
            const formattedProjects = projects.map(project => {
                return {
                    _id: project._id,
                    client: project.client,
                    title: project.title,
                    description: project.description,
                    budget: {
                        range: {
                            min: project.budget.range.min,
                            max: project.budget.range.max
                        },
                        currency: project.budget.currency,
                        flexibility: project.budget.flexibility
                    },
                    location: project.location,
                    projectType: project.projectType,
                    subType: project.subType,
                    specifications: {
                        area: {
                            value: project.specifications.area.value,
                            unit: project.specifications.area.unit
                        },
                        floors: project.specifications.floors,
                        requirements: project.specifications.requirements
                    },
                    timeline: {
                        expectedStartDate: project.timeline.expectedStartDate,
                        expectedDuration: project.timeline.expectedDuration,
                        preferredWorkingHours: project.timeline.preferredWorkingHours
                    },
                    status: project.status,
                    preferences: project.preferences,
                    visibility: project.visibility,
                    metadata: project.metadata,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt
                };
            });

            return {
                projects: formattedProjects,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new ApiError(500, 'Error searching projects', error);
        }
    }

    /**
     * Find matching vendors for a project
     */
    async findMatchingVendors(projectId) {
        try {
            const project = await Project.findById(projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            const VendorProfile = mongoose.model('VendorProfile');
            
            // Build vendor matching query
            const query = {
                'services': project.projectType,
                'location.city': project.location.city,
                'location.state': project.location.state,
                'projectRange.minBudget': { $lte: project.budget.range.min },
                'projectRange.maxBudget': { $gte: project.budget.range.max },
                'status': 'active',
                'isVerified': true
            };

            if (project.preferences?.vendorRequirements?.minExperience) {
                query['experience.yearsInBusiness'] = {
                    $gte: project.preferences.vendorRequirements.minExperience
                };
            }

            if (project.preferences?.vendorRequirements?.minRating) {
                query['ratings.average'] = {
                    $gte: project.preferences.vendorRequirements.minRating
                };
            }

            const vendors = await VendorProfile.find(query)
                .select('companyName location experience ratings')
                .sort('-ratings.average -experience.yearsInBusiness');

            return vendors;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, 'Error finding matching vendors', error);
        }
    }

    // Private helper methods

    _buildSearchQuery(criteria) {
        const query = {};
        
        console.log('_buildSearchQuery - criteria:', criteria);

        // Handle role-based visibility
        if (criteria.userRole === 'vendor_supplier') {
            // Vendors can only see OPEN projects
            query['status.current'] = 'OPEN';
        } else if (criteria.userRole === 'client_owner') {
            // Clients can see their own projects in any status
            if (criteria.status) {
                query['status.current'] = criteria.status.toUpperCase();
            }
            // Only show projects owned by this client
            query.client = criteria.userId;
            console.log('_buildSearchQuery - client query set to:', criteria.userId);
        }

        // Handle project type
        if (criteria.projectType) {
            query.projectType = criteria.projectType.toLowerCase();
        }

        // Handle location
        if (criteria.location) {
            if (criteria.location.city) {
                query['location.city'] = new RegExp(criteria.location.city, 'i');
            }
            if (criteria.location.state) {
                query['location.state'] = new RegExp(criteria.location.state, 'i');
            }
        }

        // Handle budget range
        if (criteria.budget) {
            if (criteria.budget.min) {
                query['budget.range.min'] = { $lte: parseFloat(criteria.budget.min) };
                query['budget.range.max'] = { $gte: parseFloat(criteria.budget.min) };
            }
            if (criteria.budget.max) {
                query['budget.range.max'] = { $gte: parseFloat(criteria.budget.max) };
            }
        }

        console.log('Built query for role', criteria.userRole, ':', query);
        return query;
    }

    _getCachedProject(projectId) {
        const cached = this.projectCache.get(projectId);
        if (cached && Date.now() - cached.timestamp < this.PROJECT_CACHE_TTL) {
            return cached.project;
        }
        this.projectCache.delete(projectId);
        return null;
    }

    _cacheProject(project) {
        if (this.projectCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.projectCache.keys().next().value;
            this.projectCache.delete(oldestKey);
        }

        this.projectCache.set(project._id.toString(), {
            project,
            timestamp: Date.now()
        });
    }

    _clearProjectCache(projectId) {
        if (this.projectCache) {
            this.projectCache.delete(projectId);
        }
    }
}

module.exports = new ProjectService();