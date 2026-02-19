import { Router } from 'express';
import { db } from '../db/connection.js';
import { apiResponse } from '../utils/response.js';

const router = Router();

router.get('/', (req, res) => {
    try {
        const dbCheck = db.prepare('SELECT COUNT(*) as count FROM trades').get();
        apiResponse.success(res, {
            status: 'healthy',
            database: { connected: true, tradeCount: dbCheck.count },
            version: process.env.npm_package_version || '0.12.0'
        });
    } catch (error) {
        console.error('Health check failed:', error);
        apiResponse.error(res, 'Service unhealthy', 503);
    }
});

export default router;
