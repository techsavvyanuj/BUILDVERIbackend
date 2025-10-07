const swaggerJsdoc = require('swagger-jsdoc');
const authSchemas = require('../docs/swagger/schemas/auth.schema');
const authPaths = require('../docs/swagger/paths/auth.paths');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'BuildVeritas API Documentation',
            version: '1.0.0',
            description: 'API documentation for BuildVeritas backend services'
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server'
            }
        ],
        components: {
            schemas: {
                ...authSchemas
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token in the format: Bearer <token>'
                }
            }
        },
        paths: {
            ...authPaths
        }
    },
    apis: [] // We're not using JSDoc comments anymore since we have separate files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;