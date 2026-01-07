import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Data directory - uses /data in Docker, ./data locally
const DATA_DIR = process.env.DATA_DIR || './data';
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
const dbPath = join(DATA_DIR, 'optionable.db');
const db = new Database(dbPath);

// Check if trades table exists and needs migration for 'Rolled' status
const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='trades'").get();

if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'Rolled'")) {
    // Migrate existing table to support 'Rolled' status and parentTradeId
    console.log('Migrating trades table to support Rolled status...');

    db.exec(`
        -- Create new table with updated schema
        CREATE TABLE trades_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('CSP', 'CC')),
            strike REAL NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            delta REAL,
            entryPrice REAL NOT NULL,
            closePrice REAL DEFAULT 0,
            openedDate TEXT NOT NULL,
            expirationDate TEXT NOT NULL,
            closedDate TEXT,
            status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'Expired', 'Assigned', 'Closed', 'Rolled')),
            parentTradeId INTEGER REFERENCES trades(id),
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Copy existing data
        INSERT INTO trades_new (id, ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, createdAt, updatedAt)
        SELECT id, ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, createdAt, updatedAt
        FROM trades;
        
        -- Drop old table
        DROP TABLE trades;
        
        -- Rename new table
        ALTER TABLE trades_new RENAME TO trades;
    `);

    console.log('Migration complete!');
} else if (!tableInfo) {
    // Create fresh table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('CSP', 'CC')),
        strike REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        delta REAL,
        entryPrice REAL NOT NULL,
        closePrice REAL DEFAULT 0,
        openedDate TEXT NOT NULL,
        expirationDate TEXT NOT NULL,
        closedDate TEXT,
        status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'Expired', 'Assigned', 'Closed', 'Rolled')),
        parentTradeId INTEGER REFERENCES trades(id),
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
}

// Add delta column if it doesn't exist (for existing databases)
try {
    db.exec(`ALTER TABLE trades ADD COLUMN delta REAL`);
} catch (e) {
    // Column already exists, ignore
}

// Add parentTradeId column if it doesn't exist (for existing databases)
try {
    db.exec(`ALTER TABLE trades ADD COLUMN parentTradeId INTEGER REFERENCES trades(id)`);
} catch (e) {
    // Column already exists, ignore
}

// Create indexes for performance (idempotent)
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
    CREATE INDEX IF NOT EXISTS idx_trades_openedDate ON trades(openedDate);
    CREATE INDEX IF NOT EXISTS idx_trades_expirationDate ON trades(expirationDate);
    CREATE INDEX IF NOT EXISTS idx_trades_closedDate ON trades(closedDate);
    CREATE INDEX IF NOT EXISTS idx_trades_parentTradeId ON trades(parentTradeId);
    CREATE INDEX IF NOT EXISTS idx_trades_status_openedDate ON trades(status, openedDate);
`);
console.log('📊 Database indexes verified');

// Seed example data if database is empty (for demo purposes)
const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get();
if (tradeCount.count === 0) {
    console.log('Seeding example trades...');

    // Example 1: META - Rolled CSP chain (first trade rolled, second still open)
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('META', 'CSP', 550, 1, 0.25, 3.50, 5.00, '2025-11-15', '2025-12-20', '2025-12-15', 'Rolled', NULL);
    `);
    const metaRolledId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('META', 'CSP', 520, 1, 0.22, 4.50, 0, '2025-12-15', '2026-01-17', NULL, 'Open', ${metaRolledId});
    `);

    // Example 2: HIMS - Completed CSP (expired worthless)
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('HIMS', 'CSP', 25, 1, 0.30, 0.85, 0, '2025-11-20', '2025-12-20', '2025-12-20', 'Expired', NULL);
    `);

    // Example 3: NBIS - Open Covered Call
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('NBIS', 'CC', 45, 1, 0.28, 1.20, 0, '2025-12-15', '2026-01-10', NULL, 'Open', NULL);
    `);

    console.log('Example trades seeded!');
}

// Middleware
app.use(cors());
app.use(express.json());

// Request ID middleware
app.use((req, res, next) => {
    req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    next();
});

// Response helpers for consistent API format
const apiResponse = {
    success: (res, data, meta = {}) => {
        res.json({
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        });
    },
    created: (res, data, meta = {}) => {
        res.status(201).json({
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        });
    },
    error: (res, message, statusCode = 500, details = null) => {
        res.status(statusCode).json({
            success: false,
            error: {
                message,
                ...(details && { details })
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
};

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, 'dist')));
}

// ============== API Routes ==============

// Health check endpoint
app.get('/api/health', (req, res) => {
    try {
        const dbCheck = db.prepare('SELECT COUNT(*) as count FROM trades').get();
        apiResponse.success(res, {
            status: 'healthy',
            database: { connected: true, tradeCount: dbCheck.count },
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        apiResponse.error(res, 'Service unhealthy', 503, { database: error.message });
    }
});

// GET all trades with pagination, filtering, and sorting
app.get('/api/trades', (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            ticker,
            sortBy = 'openedDate',
            sortDir = 'asc'
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        // Valid sort columns (whitelist for SQL injection prevention)
        const validSortColumns = ['openedDate', 'expirationDate', 'closedDate', 'ticker', 'strike', 'status', 'entryPrice', 'closePrice', 'type', 'id'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'openedDate';
        const sortDirection = sortDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

        // Build WHERE clause
        const conditions = [];
        const params = [];

        if (status && status !== 'all') {
            if (status === 'open') {
                conditions.push('status = ?');
                params.push('Open');
            } else if (status === 'closed') {
                conditions.push("status IN ('Expired', 'Assigned', 'Closed', 'Rolled')");
            } else {
                conditions.push('status = ?');
                params.push(status);
            }
        }

        if (ticker) {
            conditions.push('ticker = ?');
            params.push(ticker.toUpperCase());
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM trades ${whereClause}`;
        const { total } = db.prepare(countQuery).get(...params);

        // Get paginated data
        const dataQuery = `
            SELECT * FROM trades
            ${whereClause}
            ORDER BY ${sortColumn} ${sortDirection}, id ASC
            LIMIT ? OFFSET ?
        `;
        const trades = db.prepare(dataQuery).all(...params, limitNum, offset);

        const totalPages = Math.ceil(total / limitNum);

        apiResponse.success(res, trades, {
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1
            }
        });
    } catch (error) {
        console.error('Error fetching trades:', error);
        apiResponse.error(res, 'Failed to fetch trades');
    }
});

// GET single trade
app.get('/api/trades/:id', (req, res) => {
    try {
        const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
        if (!trade) {
            return apiResponse.error(res, 'Trade not found', 404);
        }
        apiResponse.success(res, trade);
    } catch (error) {
        console.error('Error fetching trade:', error);
        apiResponse.error(res, 'Failed to fetch trade');
    }
});

// POST create new trade
app.post('/api/trades', (req, res) => {
    try {
        const {
            ticker,
            type,
            strike,
            quantity,
            delta,
            entryPrice,
            closePrice,
            openedDate,
            expirationDate,
            closedDate,
            status,
            parentTradeId
        } = req.body;

        const stmt = db.prepare(`
      INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            ticker.toUpperCase(),
            type,
            strike,
            quantity || 1,
            delta || null,
            entryPrice,
            closePrice || 0,
            openedDate,
            expirationDate,
            closedDate || null,
            status || 'Open',
            parentTradeId || null
        );

        const newTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, newTrade);
    } catch (error) {
        console.error('Error creating trade:', error);
        apiResponse.error(res, 'Failed to create trade');
    }
});

// POST bulk import trades
app.post('/api/trades/import', (req, res) => {
    try {
        const { trades } = req.body;

        if (!Array.isArray(trades) || trades.length === 0) {
            return apiResponse.error(res, 'No trades provided', 400);
        }

        const stmt = db.prepare(`
            INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((trades) => {
            let imported = 0;
            for (const trade of trades) {
                try {
                    stmt.run(
                        trade.ticker?.toUpperCase(),
                        trade.type,
                        trade.strike,
                        trade.quantity || 1,
                        trade.delta || null,
                        trade.entryPrice,
                        trade.closePrice || 0,
                        trade.openedDate,
                        trade.expirationDate,
                        trade.closedDate || null,
                        trade.status || 'Open',
                        trade.parentTradeId || null
                    );
                    imported++;
                } catch (e) {
                    console.error('Error importing trade:', e, trade);
                }
            }
            return imported;
        });

        const imported = insertMany(trades);
        apiResponse.created(res, { imported, total: trades.length });
    } catch (error) {
        console.error('Error importing trades:', error);
        apiResponse.error(res, 'Failed to import trades');
    }
});

// PUT update trade
app.put('/api/trades/:id', (req, res) => {
    try {
        const {
            ticker,
            type,
            strike,
            quantity,
            delta,
            entryPrice,
            closePrice,
            openedDate,
            expirationDate,
            closedDate,
            status,
            parentTradeId
        } = req.body;

        const stmt = db.prepare(`
      UPDATE trades
      SET ticker = ?, type = ?, strike = ?, quantity = ?, delta = ?, entryPrice = ?, closePrice = ?,
          openedDate = ?, expirationDate = ?, closedDate = ?, status = ?, parentTradeId = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

        const result = stmt.run(
            ticker.toUpperCase(),
            type,
            strike,
            quantity || 1,
            delta || null,
            entryPrice,
            closePrice || 0,
            openedDate,
            expirationDate,
            closedDate || null,
            status || 'Open',
            parentTradeId || null,
            req.params.id
        );

        if (result.changes === 0) {
            return apiResponse.error(res, 'Trade not found', 404);
        }

        const updatedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
        apiResponse.success(res, updatedTrade);
    } catch (error) {
        console.error('Error updating trade:', error);
        apiResponse.error(res, 'Failed to update trade');
    }
});

// DELETE trade
app.delete('/api/trades/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM trades WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return apiResponse.error(res, 'Trade not found', 404);
        }
        apiResponse.success(res, { deleted: true, id: parseInt(req.params.id) });
    } catch (error) {
        console.error('Error deleting trade:', error);
        apiResponse.error(res, 'Failed to delete trade');
    }
});

// GET stats/summary - Using SQL aggregations for performance
app.get('/api/stats', (req, res) => {
    try {
        // Main stats aggregation - single query
        const mainStats = db.prepare(`
            SELECT
                COUNT(*) as totalTrades,
                COUNT(CASE WHEN status = 'Open' THEN 1 END) as openCount,
                COUNT(CASE WHEN status = 'Expired' THEN 1 END) as expiredCount,
                COUNT(CASE WHEN status = 'Assigned' THEN 1 END) as assignedCount,
                COUNT(CASE WHEN status = 'Rolled' THEN 1 END) as rolledCount,
                COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closedCount,
                COALESCE(SUM((entryPrice - closePrice) * quantity * 100), 0) as totalPnL,
                COALESCE(SUM(entryPrice * quantity * 100), 0) as totalPremium,
                COALESCE(SUM(CASE WHEN status = 'Open' THEN strike * quantity * 100 ELSE 0 END), 0) as capitalAtRisk
            FROM trades
        `).get();

        // Chain statistics - count roots and resolved chains
        const chainStats = db.prepare(`
            SELECT
                COUNT(*) as totalChains,
                COUNT(CASE WHEN status NOT IN ('Open', 'Rolled') THEN 1 END) as resolvedChains
            FROM trades
            WHERE parentTradeId IS NULL
        `).get();

        // For win rate, we need to calculate chain P/L (requires iteration for now)
        // This is still needed because chain P/L spans multiple rows
        const chainRoots = db.prepare(`SELECT * FROM trades WHERE parentTradeId IS NULL`).all();
        const allTrades = db.prepare(`SELECT * FROM trades`).all();

        let winningChains = 0;
        let resolvedCount = 0;

        for (const root of chainRoots) {
            let chainPnL = (root.entryPrice - root.closePrice) * root.quantity * 100;
            let currentId = root.id;
            let finalStatus = root.status;

            // Follow the chain
            let child = allTrades.find(t => t.parentTradeId === currentId);
            while (child) {
                chainPnL += (child.entryPrice - child.closePrice) * child.quantity * 100;
                finalStatus = child.status;
                currentId = child.id;
                child = allTrades.find(t => t.parentTradeId === currentId);
            }

            if (finalStatus !== 'Open' && finalStatus !== 'Rolled') {
                resolvedCount++;
                if (chainPnL > 0) winningChains++;
            }
        }

        const winRate = resolvedCount > 0 ? (winningChains / resolvedCount) * 100 : 0;

        // Monthly P/L aggregation
        const monthlyStats = db.prepare(`
            SELECT
                strftime('%Y-%m', COALESCE(closedDate, openedDate)) as month,
                SUM((entryPrice - closePrice) * quantity * 100) as pnl
            FROM trades
            WHERE status NOT IN ('Open', 'Rolled')
            GROUP BY month
            ORDER BY month DESC
        `).all();

        // Ticker P/L aggregation
        const tickerStats = db.prepare(`
            SELECT
                ticker,
                SUM((entryPrice - closePrice) * quantity * 100) as pnl
            FROM trades
            GROUP BY ticker
            ORDER BY pnl DESC
        `).all();

        // Best ticker
        const bestTicker = tickerStats.length > 0 ? tickerStats[0] : null;

        // Average ROI for completed trades
        const avgRoiResult = db.prepare(`
            SELECT AVG(
                CASE WHEN strike > 0 AND quantity > 0
                THEN ((entryPrice - closePrice) * 100.0) / strike
                ELSE 0 END
            ) as avgRoi
            FROM trades
            WHERE status NOT IN ('Open', 'Rolled')
        `).get();

        apiResponse.success(res, {
            totalPnL: mainStats.totalPnL,
            totalPremiumCollected: mainStats.totalPremium,
            totalTrades: mainStats.totalTrades,
            openTradesCount: mainStats.openCount,
            completedTradesCount: mainStats.expiredCount + mainStats.assignedCount + mainStats.closedCount,
            capitalAtRisk: mainStats.capitalAtRisk,
            winningChains,
            totalChains: chainStats.totalChains,
            resolvedChains: resolvedCount,
            winRate,
            avgRoi: avgRoiResult.avgRoi || 0,
            totalAssigned: mainStats.assignedCount,
            totalExpired: mainStats.expiredCount,
            totalRolled: mainStats.rolledCount,
            monthlyStats: Object.fromEntries(monthlyStats.map(m => [m.month, m.pnl])),
            tickerStats: Object.fromEntries(tickerStats.map(t => [t.ticker, t.pnl])),
            bestTicker
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        apiResponse.error(res, 'Failed to fetch stats');
    }
});

// Catch-all for SPA routing in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(join(__dirname, 'dist', 'index.html'));
    });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 Optionable server running on port ${PORT}`);
    console.log(`📁 Database: ${dbPath}`);
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

