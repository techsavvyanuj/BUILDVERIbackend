const cors = require('cors');

const allowedOrigins = [
    // Local development
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    
    // Production domains
    'https://build-veritas.vercel.app',
    'https://buildveritas.vercel.app',
    
    // Backend domain
    'https://buildveritas.onrender.com',
    'https://buildveritas-backend.onrender.com'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Always allow in development
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        // Allow requests with no origin (like mobile apps, Postman, or curl requests)
        if (!origin) {
            return callback(null, true);
        }

        // Allow all Vercel preview deployments and local development
        if (
            origin.endsWith('.vercel.app') || 
            origin.includes('localhost') || 
            origin.includes('127.0.0.1') ||
            allowedOrigins.includes(origin)
        ) {
            callback(null, true);
        } else {
            console.log('⚠️ Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 86400, // 24 hours
    preflightContinue: false
};

module.exports = cors(corsOptions);