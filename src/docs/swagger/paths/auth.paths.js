/**
 * Swagger paths for authentication routes
 */

const authPaths = {
    '/api/auth/register': {
        post: {
            tags: ['Authentication'],
            summary: 'Register a new user',
            description: 'Create a new user account with email and password',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/RegisterRequest'
                        }
                    }
                }
            },
            responses: {
                201: {
                    description: 'User registered successfully',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthResponse'
                            }
                        }
                    }
                },
                400: {
                    description: 'Validation error or email already exists'
                },
                500: {
                    description: 'Server error'
                }
            }
        }
    },
    '/api/auth/login': {
        post: {
            tags: ['Authentication'],
            summary: 'Login user',
            description: 'Authenticate user and return JWT token',
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/LoginRequest'
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: 'Login successful',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AuthResponse'
                            }
                        }
                    }
                },
                401: {
                    description: 'Invalid credentials'
                },
                500: {
                    description: 'Server error'
                }
            }
        }
    },
    '/api/auth/profile': {
        get: {
            tags: ['Authentication'],
            summary: 'Get user profile',
            description: "Retrieve the authenticated user's profile information",
            security: [
                {
                    bearerAuth: []
                }
            ],
            responses: {
                200: {
                    description: 'Profile retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    user: {
                                        type: 'object',
                                        properties: {
                                            id: {
                                                type: 'string'
                                            },
                                            email: {
                                                type: 'string'
                                            },
                                            firstName: {
                                                type: 'string'
                                            },
                                            lastName: {
                                                type: 'string'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                401: {
                    description: 'Unauthorized - Invalid or missing token'
                },
                500: {
                    description: 'Server error'
                }
            }
        }
    },
    '/api/auth/users': {
        get: {
            tags: ['User Management'],
            summary: 'Get all users',
            description: 'Retrieve a paginated list of all users (Admin only)',
            security: [
                {
                    bearerAuth: []
                }
            ],
            parameters: [
                {
                    in: 'query',
                    name: 'page',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 1
                    },
                    description: 'Page number'
                },
                {
                    in: 'query',
                    name: 'limit',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                        default: 10
                    },
                    description: 'Number of items per page'
                }
            ],
            responses: {
                200: {
                    description: 'Users retrieved successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    users: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: {
                                                    type: 'string'
                                                },
                                                email: {
                                                    type: 'string'
                                                },
                                                firstName: {
                                                    type: 'string'
                                                },
                                                lastName: {
                                                    type: 'string'
                                                },
                                                role: {
                                                    type: 'string',
                                                    enum: ['admin', 'client']
                                                }
                                            }
                                        }
                                    },
                                    pagination: {
                                        type: 'object',
                                        properties: {
                                            total: {
                                                type: 'integer',
                                                description: 'Total number of users'
                                            },
                                            page: {
                                                type: 'integer',
                                                description: 'Current page'
                                            },
                                            limit: {
                                                type: 'integer',
                                                description: 'Items per page'
                                            },
                                            pages: {
                                                type: 'integer',
                                                description: 'Total number of pages'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                401: {
                    description: 'Unauthorized - Invalid or missing token'
                },
                403: {
                    description: 'Forbidden - Admin access required'
                },
                500: {
                    description: 'Server error'
                }
            }
        }
    },
    '/api/auth/users/{userId}': {
        delete: {
            tags: ['User Management'],
            summary: 'Delete a user',
            description: 'Delete a user by ID (Admin only)',
            security: [
                {
                    bearerAuth: []
                }
            ],
            parameters: [
                {
                    in: 'path',
                    name: 'userId',
                    required: true,
                    schema: {
                        type: 'string',
                        format: 'mongoId'
                    },
                    description: 'ID of the user to delete'
                }
            ],
            responses: {
                200: {
                    description: 'User deleted successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: {
                                        type: 'string',
                                        example: 'User deleted successfully'
                                    },
                                    deletedUser: {
                                        type: 'object',
                                        properties: {
                                            id: {
                                                type: 'string'
                                            },
                                            email: {
                                                type: 'string'
                                            },
                                            firstName: {
                                                type: 'string'
                                            },
                                            lastName: {
                                                type: 'string'
                                            },
                                            role: {
                                                type: 'string',
                                                enum: ['admin', 'client']
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                400: {
                    description: 'Invalid user ID or admin trying to delete themselves'
                },
                401: {
                    description: 'Unauthorized - Invalid or missing token'
                },
                403: {
                    description: 'Forbidden - Admin access required'
                },
                404: {
                    description: 'User not found'
                },
                500: {
                    description: 'Server error'
                }
            }
        }
    }
};

module.exports = authPaths;