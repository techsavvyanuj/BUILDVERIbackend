const { validationResult } = require('express-validator');
const clientProfileService = require('../services/client.profile.service');
const { ApiResponse } = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');

class ClientProfileController {
    async createOrUpdateProfile(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            if (req.user.role !== 'client_owner') {
                throw new ApiError(403, 'Only clients can manage client profiles');
            }

            const profile = await clientProfileService.createOrUpdateProfile(req.user.id, req.body);
            return ApiResponse.success(res, profile, 'Client profile saved successfully');
        } catch (error) {
            next(error);
        }
    }

    async getProfile(req, res, next) {
        try {
            const profile = await clientProfileService.getProfileById(req.user.id);
            return ApiResponse.success(res, profile, 'Client profile retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    async addProject(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            const project = await clientProfileService.addProject(req.user.id, req.body);
            return ApiResponse.success(res, project, 'Project added successfully');
        } catch (error) {
            next(error);
        }
    }

    async updateProject(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            const project = await clientProfileService.updateProject(
                req.user.id,
                req.params.projectId,
                req.body
            );
            return ApiResponse.success(res, project, 'Project updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async deleteProject(req, res, next) {
        try {
            await clientProfileService.deleteProject(req.user.id, req.params.projectId);
            return ApiResponse.success(res, null, 'Project deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    async uploadPhotos(req, res, next) {
        try {
            if (!req.files || req.files.length === 0) {
                throw new ApiError(400, 'No files uploaded');
            }

            const photos = await clientProfileService.uploadPhotos(req.user.id, req.files);
            return ApiResponse.success(res, photos, 'Photos uploaded successfully');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ClientProfileController();