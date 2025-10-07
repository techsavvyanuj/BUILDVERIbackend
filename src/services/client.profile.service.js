const ClientProfile = require('../models/client.profile.model');
const { ApiError } = require('../utils/apiError');

class ClientProfileService {
    async createOrUpdateProfile(userId, profileData) {
        // Find profile and update, or create if doesn't exist
        const profile = await ClientProfile.findOneAndUpdate(
            { user: userId },
            {
                user: userId,
                ...profileData
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return profile;
    }

    async getProfileById(userId) {
        const profile = await ClientProfile.findOne({ user: userId })
            .populate('user', 'firstName lastName email');

        if (!profile) {
            throw new ApiError(404, 'Client profile not found');
        }

        return profile;
    }

    async addProject(userId, projectData) {
        const profile = await ClientProfile.findOne({ user: userId });
        if (!profile) {
            throw new ApiError(404, 'Client profile not found');
        }

        profile.activeProjects.push(projectData);
        await profile.save();

        return profile.activeProjects[profile.activeProjects.length - 1];
    }

    async updateProject(userId, projectId, updateData) {
        const profile = await ClientProfile.findOne({ user: userId });
        if (!profile) {
            throw new ApiError(404, 'Client profile not found');
        }

        const project = profile.activeProjects.id(projectId);
        if (!project) {
            throw new ApiError(404, 'Project not found');
        }

        Object.assign(project, updateData);
        await profile.save();

        return project;
    }

    async deleteProject(userId, projectId) {
        const profile = await ClientProfile.findOne({ user: userId });
        if (!profile) {
            throw new ApiError(404, 'Client profile not found');
        }

        profile.activeProjects = profile.activeProjects.filter(
            project => project._id.toString() !== projectId
        );
        
        await profile.save();
    }

    async uploadPhotos(userId, files) {
        const profile = await ClientProfile.findOne({ user: userId });
        if (!profile) {
            throw new ApiError(404, 'Client profile not found');
        }

        // Process and add photos
        const photos = files.map(file => ({
            url: file.path, // Assuming file path is stored
            uploadedAt: new Date()
        }));

        profile.photos.push(...photos);
        await profile.save();

        return photos;
    }
}

module.exports = new ClientProfileService();