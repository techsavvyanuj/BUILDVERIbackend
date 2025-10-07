/**
 * Swagger schemas for authentication
 */

const authSchemas = {
    RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
            email: {
                type: 'string',
                format: 'email',
                description: "User's email address",
                example: 'john.doe@example.com'
            },
            password: {
                type: 'string',
                format: 'password',
                minLength: 8,
                description: "User's password (min 8 characters, must include a number)",
                example: 'Password123'
            },
            firstName: {
                type: 'string',
                minLength: 2,
                description: "User's first name",
                example: 'John'
            },
            lastName: {
                type: 'string',
                minLength: 2,
                description: "User's last name",
                example: 'Doe'
            }
        }
    },
    LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: {
                type: 'string',
                format: 'email',
                description: "User's email address",
                example: 'john.doe@example.com'
            },
            password: {
                type: 'string',
                format: 'password',
                description: "User's password",
                example: 'Password123'
            }
        }
    },
    AuthResponse: {
        type: 'object',
        properties: {
            token: {
                type: 'string',
                description: 'JWT token for authentication'
            },
            user: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: "User's unique identifier"
                    },
                    email: {
                        type: 'string',
                        description: "User's email"
                    },
                    firstName: {
                        type: 'string',
                        description: "User's first name"
                    },
                    lastName: {
                        type: 'string',
                        description: "User's last name"
                    }
                }
            }
        }
    }
};

module.exports = authSchemas;
