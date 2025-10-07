const { validationResult } = require('express-validator');
const budgetEstimateService = require('../services/budget.estimate.service');
const { ApiResponse } = require('../utils/apiResponse');
const { ApiError } = require('../utils/apiError');

class BudgetEstimateController {
    constructor() {
        // Bind methods to instance
        this.createEstimate = this.createEstimate.bind(this);
        this.getEstimate = this.getEstimate.bind(this);
        this.getUserEstimates = this.getUserEstimates.bind(this);
    }

    async createEstimate(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new ApiError(400, 'Validation Error', errors.array());
            }

            const estimate = await budgetEstimateService.createEstimate(
                req.user.id,
                req.body
            );

            return ApiResponse.success(
                res,
                estimate,
                'Budget estimation process started'
            );
        } catch (error) {
            next(error);
        }
    }

    async getEstimate(req, res, next) {
        try {
            const estimate = await budgetEstimateService.getEstimate(
                req.params.id,
                req.user.id
            );

            return ApiResponse.success(
                res,
                estimate,
                'Budget estimate retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    }

    async getUserEstimates(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const result = await budgetEstimateService.getUserEstimates(
                req.user.id,
                page,
                limit
            );

            return ApiResponse.success(
                res,
                result,
                'Budget estimates retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new BudgetEstimateController();
