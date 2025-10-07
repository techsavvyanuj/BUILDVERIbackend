const User = require('../models/user.model');

class UserRepository {
    async create(userData) {
        return await User.create(userData);
    }

    async findById(id) {
        return await User.findById(id);
    }

    async findByEmail(email) {
        return await User.findOne({ email });
    }

    async update(id, updateData) {
        return await User.findByIdAndUpdate(id, updateData, { new: true });
    }

    async delete(id) {
        return await User.findByIdAndDelete(id);
    }

    async findAll(skip = 0, limit = 10) {
        return await User.find()
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip(skip)
            .limit(limit);
    }

    async count() {
        return await User.countDocuments();
    }

    async deleteById(id) {
        return await User.findByIdAndDelete(id);
    }
}

module.exports = UserRepository;