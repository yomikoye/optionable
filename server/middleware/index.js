import cors from 'cors';
import express from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export const registerMiddleware = (app) => {
    // CORS: restrict to same origin in production, allow all in dev
    if (isProduction) {
        app.use(cors({ origin: false }));
    } else {
        app.use(cors());
    }

    app.use(express.json());

    // Security headers
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '0');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        if (isProduction) {
            res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
        }
        next();
    });

    // Request ID middleware
    app.use((req, res, next) => {
        req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        next();
    });

    // Disable X-Powered-By header (hides Express)
    app.disable('x-powered-by');
};
