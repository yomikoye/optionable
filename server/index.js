import express from 'express';
import { join } from 'path';

import { db, dbPath } from './db/connection.js';
import { handleLegacyDb, runMigrations } from './db/migrations.js';
import { fixCostBasis, cleanOrphanedPositions, seedDemoData } from './db/seed.js';
import { registerMiddleware } from './middleware/index.js';

import healthRouter from './routes/health.js';
import tradesRouter from './routes/trades.js';
import statsRouter from './routes/stats.js';
import positionsRouter from './routes/positions.js';
import pricesRouter from './routes/prices.js';
import settingsRouter from './routes/settings.js';
import accountsRouter from './routes/accounts.js';
import fundTransactionsRouter from './routes/fundTransactions.js';
import stocksRouter from './routes/stocks.js';
import portfolioRouter from './routes/portfolio.js';

// Run startup sequence: migrations → FK enable → fixups → seed
handleLegacyDb();
runMigrations();
db.pragma('foreign_keys = ON');
fixCostBasis();
cleanOrphanedPositions();
seedDemoData();

export const createApp = (rootDir) => {
    const app = express();

    // Middleware
    registerMiddleware(app);

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
        app.use(express.static(join(rootDir, 'dist')));
    }

    // API Routes
    app.use('/api/health', healthRouter);
    app.use('/api/trades', tradesRouter);
    app.use('/api/stats', statsRouter);
    app.use('/api/positions', positionsRouter);
    app.use('/api/prices', pricesRouter);
    app.use('/api/settings', settingsRouter);
    app.use('/api/accounts', accountsRouter);
    app.use('/api/fund-transactions', fundTransactionsRouter);
    app.use('/api/stocks', stocksRouter);
    app.use('/api/portfolio', portfolioRouter);

    // Catch-all for SPA routing in production
    if (process.env.NODE_ENV === 'production') {
        app.get('*', (req, res) => {
            res.sendFile(join(rootDir, 'dist', 'index.html'));
        });
    }

    return app;
};

export const startServer = (app) => {
    const PORT = process.env.PORT || 8080;

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🎯 Optionable server running on port ${PORT}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`📁 Database: ${dbPath}`);
        }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        db.close();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        db.close();
        process.exit(0);
    });
};
