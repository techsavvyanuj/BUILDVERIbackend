const helmet = require('helmet');

const helmetConfig = helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "https://*.vercel.app", "http://localhost:*", "https://*.onrender.com"],
            imgSrc: ["'self'", "data:", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            fontSrc: ["'self'", "data:", "https:"],
            mediaSrc: ["'self'", "data:", "https:"]
        }
    }
});

module.exports = helmetConfig;
