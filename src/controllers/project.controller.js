const projectService = require('../services/project.service');
const { ApiError } = require('../utils/apiError');
const { ApiResponse } = require('../utils/apiResponse');

class ProjectController {
    /**
     * Create and publish a project
     */
    async createAndPublish(req, res, next) {
        try {
            console.log('User from request:', req.user);
            const clientId = req.user.id;
            console.log('Client ID being used:', clientId);
            
            const project = await projectService.createAndPublish(clientId, req.body);
            
            res.status(201).json(new ApiResponse(
                201,
                'Project created and published successfully. Vendors can now view and bid on your project.',
                project
            ));
        } catch (error) {
            next(error);
        }
    }
    // Removed createProject and publishProject - only using createAndPublish now

    /**
     * Update a project
     */
    async updateProject(req, res, next) {
        try {
            const { projectId } = req.params;
            const clientId = req.user.id; // JWT token has 'id', not '_id'
            
            const project = await projectService.updateProject(
                projectId,
                clientId,
                req.body
            );
            
            res.status(200).json(new ApiResponse(
                200,
                'Project updated successfully',
                project
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a project
     */
    async deleteProject(req, res, next) {
        try {
            const { projectId } = req.params;
            const userId = req.user.id; // JWT contains 'id' not '_id'
            
            console.log('deleteProject - userId:', userId);
            console.log('deleteProject - projectId:', projectId);

            // First, get the client profile to find the actual client ID
            const ClientProfile = require('mongoose').model('ClientProfile');
            const clientProfile = await ClientProfile.findOne({ user: userId });
            
            console.log('deleteProject - clientProfile:', clientProfile);
            
            if (!clientProfile) {
                throw new ApiError(404, 'Client profile not found');
            }

            await projectService.deleteProject(projectId, clientProfile._id);
            
            res.status(200).json(new ApiResponse(
                200,
                'Project deleted successfully'
            ));
        } catch (error) {
            console.error('deleteProject - error:', error);
            next(error);
        }
    }

    /**
     * Get project details
     */
    async getProject(req, res, next) {
        try {
            const { projectId } = req.params;
            const project = await projectService.getProjectById(projectId);
            
            res.status(200).json(new ApiResponse(
                200,
                'Project retrieved successfully',
                project
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Search projects
     */
    async searchProjects(req, res, next) {
        try {
            const { 
                status, 
                projectType, 
                location, 
                budget,
                page = 1,
                limit = 10,
                sort = '-metadata.createdAt'
            } = req.query;

            // Get user role from auth (if available)
            const userRole = req.user?.role || 'vendor_supplier'; // Default to vendor for public access
            const userId = req.user?.id || undefined; // Explicitly set to undefined if no user

            const criteria = {
                status,
                projectType,
                location,
                budget: budget ? {
                    min: parseFloat(budget.min),
                    max: parseFloat(budget.max)
                } : undefined,
                userRole, // Pass user role to service
                userId // Pass user ID to service (may be undefined for public access)
            };

            const results = await projectService.searchProjects(criteria, {
                page: parseInt(page),
                limit: parseInt(limit),
                sort
            });
            
            const message = results.projects.length > 0 
                ? 'Projects retrieved successfully'
                : 'No projects found matching the criteria';

            return ApiResponse.success(
                res,
                {
                    projects: results.projects,
                    pagination: results.pagination
                },
                message
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get matching vendors for a project
     */
    async getMatchingVendors(req, res, next) {
        try {
            const { projectId } = req.params;
            const vendors = await projectService.findMatchingVendors(projectId);
            
            res.status(200).json(new ApiResponse(
                200,
                'Matching vendors retrieved successfully',
                vendors
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get client's projects
     */
    async getClientProjects(req, res, next) {
        try {
            const clientId = req.user.id; // JWT contains 'id' not '_id'
            const { status, page = 1, limit = 10 } = req.query;
            
            console.log('getClientProjects - clientId:', clientId);
            console.log('getClientProjects - query params:', { status, page, limit });

            // First, get the client profile to find the actual client ID
            const ClientProfile = require('mongoose').model('ClientProfile');
            const clientProfile = await ClientProfile.findOne({ user: clientId });
            
            console.log('getClientProjects - clientProfile:', clientProfile);
            
            if (!clientProfile) {
                console.log('getClientProjects - No client profile found, returning empty results');
                return res.status(200).json({
                    status: 'success',
                    message: 'Client projects retrieved successfully',
                    data: { projects: [], total: 0, page: 1, limit: 10 }
                });
            }

            const searchCriteria = { userId: clientProfile._id, status, userRole: 'client_owner' };
            console.log('getClientProjects - searchCriteria:', searchCriteria);
            
            const results = await projectService.searchProjects(
                searchCriteria,
                { page: parseInt(page), limit: parseInt(limit) }
            );
            
            console.log('getClientProjects - results:', results);
            
            // Ensure we return the projects in the correct format
            const responseData = {
                projects: results.projects || [],
                total: results.pagination?.total || 0,
                page: results.pagination?.page || parseInt(page),
                limit: results.pagination?.limit || parseInt(limit)
            };
            
            console.log('getClientProjects - final response data:', responseData);
            
            res.status(200).json({
                status: 'success',
                message: 'Client projects retrieved successfully',
                data: responseData
            });
        } catch (error) {
            console.error('getClientProjects - error:', error);
            next(error);
        }
    }

    /**
     * Get vendor's projects (projects where vendor has been selected)
     */
    async getVendorProjects(req, res, next) {
        try {
            const vendorId = req.user.id;
            const { status, page = 1, limit = 10 } = req.query;
            
            console.log('getVendorProjects - vendorId:', vendorId);
            console.log('getVendorProjects - query params:', { status, page, limit });

            // First, get the vendor profile to find the actual vendor ID
            const VendorProfile = require('mongoose').model('VendorProfile');
            const vendorProfile = await VendorProfile.findOne({ user: vendorId });
            
            console.log('getVendorProjects - vendorProfile:', vendorProfile);
            
            if (!vendorProfile) {
                console.log('getVendorProjects - No vendor profile found, returning empty results');
                return res.status(200).json({
                    status: 'success',
                    message: 'Vendor projects retrieved successfully',
                    data: { projects: [], total: 0, page: 1, limit: 10 }
                });
            }

            // Find projects where this vendor has bid on (regardless of acceptance status)
            const Project = require('mongoose').model('Project');
            const Bid = require('mongoose').model('Bid');
            
            // First, get all project IDs where this vendor has bid
            const vendorBids = await Bid.find({ 
                vendor: vendorProfile._id 
            }).select('project status.current');
            
            const projectIds = vendorBids.map(bid => bid.project);
            
            console.log('getVendorProjects - vendor bids found:', vendorBids.length);
            console.log('getVendorProjects - project IDs:', projectIds);
            
            if (projectIds.length === 0) {
                return res.status(200).json({
                    status: 'success',
                    message: 'Vendor projects retrieved successfully',
                    data: { projects: [], total: 0, page: 1, limit: 10 }
                });
            }
            
            // Now find projects that the vendor has bid on
            const query = { 
                _id: { $in: projectIds }
            };

            if (status) {
                query['status.current'] = status;
            }
            
            console.log('getVendorProjects - query:', query);
            
            const projects = await Project.find(query)
                .populate('client', 'name email phone')
                .sort({ 'metadata.createdAt': -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Project.countDocuments(query);
            
            console.log('getVendorProjects - projects found:', projects.length);
            
            // Add bid information to each project
            const projectsWithBids = await Promise.all(projects.map(async (project) => {
                const projectBid = await Bid.findOne({ 
                    project: project._id, 
                    vendor: vendorProfile._id 
                }).select('status.current proposedCost.total metadata.submittedAt');
                
                return {
                    ...project.toObject(),
                    vendorBid: projectBid
                };
            }));
            
            const responseData = {
                projects: projectsWithBids || [],
                total: total || 0,
                page: parseInt(page),
                limit: parseInt(limit)
            };
            
            console.log('getVendorProjects - final response data:', responseData);
            
            res.status(200).json({
                status: 'success',
                message: 'Vendor projects retrieved successfully',
                data: responseData
            });
        } catch (error) {
            console.error('getVendorProjects - error:', error);
            next(error);
        }
    }
}

module.exports = new ProjectController();
