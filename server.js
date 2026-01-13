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

// ============== v0.6.0: Capital Gains Tables ==============

// Positions table - track share positions from assignments
db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        shares INTEGER NOT NULL,
        costBasis REAL NOT NULL,
        acquiredDate TEXT NOT NULL,
        acquiredFromTradeId INTEGER REFERENCES trades(id),
        soldDate TEXT,
        salePrice REAL,
        soldViaTradeId INTEGER REFERENCES trades(id),
        capitalGainLoss REAL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_positions_ticker ON positions(ticker);
    CREATE INDEX IF NOT EXISTS idx_positions_soldDate ON positions(soldDate);
    CREATE INDEX IF NOT EXISTS idx_positions_acquiredFromTradeId ON positions(acquiredFromTradeId);
`);

// Price cache table - cache stock prices from external API
db.exec(`
    CREATE TABLE IF NOT EXISTS price_cache (
        ticker TEXT PRIMARY KEY,
        price REAL NOT NULL,
        change REAL,
        changePercent REAL,
        name TEXT,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Settings table - app configuration
db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Initialize default settings
const livePricesSetting = db.prepare('SELECT * FROM settings WHERE key = ?').get('live_prices_enabled');
if (!livePricesSetting) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('live_prices_enabled', 'true');
}

console.log('📈 Capital gains tables verified');

// Migration: Fix existing positions cost basis to include premium collected
// Cost basis should be strike - premium, not just strike
const positionsToFix = db.prepare(`
    SELECT p.id, p.costBasis, p.shares, p.salePrice, t.strike, t.entryPrice
    FROM positions p
    JOIN trades t ON p.acquiredFromTradeId = t.id
    WHERE p.acquiredFromTradeId IS NOT NULL
`).all();

let fixedCount = 0;
for (const pos of positionsToFix) {
    const correctCostBasis = pos.strike - pos.entryPrice;
    // Only fix if the cost basis is wrong (equals strike without premium adjustment)
    if (Math.abs(pos.costBasis - pos.strike) < 0.01) {
        let capitalGainLoss = null;
        if (pos.salePrice !== null) {
            capitalGainLoss = (pos.salePrice - correctCostBasis) * pos.shares;
        }
        db.prepare(`
            UPDATE positions
            SET costBasis = ?, capitalGainLoss = COALESCE(?, capitalGainLoss), updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(correctCostBasis, capitalGainLoss, pos.id);
        fixedCount++;
    }
}
if (fixedCount > 0) {
    console.log(`🔧 Fixed ${fixedCount} position(s) cost basis to include premium collected`);
}

// Seed example data if database is empty (for demo purposes)
const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get();
if (tradeCount.count === 0) {
    console.log('Seeding example trades...');

    // Example 1: AAPL - Simple CSP (expired worthless - ideal outcome)
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('AAPL', 'CSP', 220, 1, 0.25, 2.80, 0, '2025-11-18', '2025-12-20', '2025-12-20', 'Expired', NULL);
    `);

    // Example 2: MSFT - Simple CC (expired worthless - ideal outcome)
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('MSFT', 'CC', 450, 1, 0.30, 3.50, 0, '2025-11-20', '2025-12-20', '2025-12-20', 'Expired', NULL);
    `);

    // Example 3: META - Rolled CSP chain (rolled out and down for more premium)
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('META', 'CSP', 580, 1, 0.28, 4.20, 6.50, '2025-11-15', '2025-12-20', '2025-12-18', 'Rolled', NULL);
    `);
    const metaRolledId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('META', 'CSP', 560, 1, 0.25, 5.80, 0, '2025-12-18', '2026-01-17', NULL, 'Open', ${metaRolledId});
    `);

    // Example 4: NVDA - CSP Assigned then CC sold (full wheel cycle)
    // First: CSP was assigned (bought 100 shares at strike)
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('NVDA', 'CSP', 130, 1, 0.32, 3.80, 0, '2025-11-10', '2025-12-06', '2025-12-06', 'Assigned', NULL);
    `);
    const nvdaCspId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    // Then: CC sold on the assigned shares - also assigned (shares called away at $140)
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('NVDA', 'CC', 140, 1, 0.28, 4.50, 0, '2025-12-09', '2025-12-20', '2025-12-20', 'Assigned', ${nvdaCspId});
    `);
    const nvdaCcId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    // Position: Bought at $130 (CSP assigned), sold at $140 (CC assigned) = $1,000 gain
    db.exec(`
        INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, soldDate, salePrice, soldViaTradeId, capitalGainLoss)
        VALUES ('NVDA', 100, 130, '2025-12-06', ${nvdaCspId}, '2025-12-20', 140, ${nvdaCcId}, 1000);
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
            version: process.env.npm_package_version || '0.7.0'
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

        const tickerUpper = ticker.toUpperCase();
        let resolvedParentTradeId = parentTradeId || null;

        // Auto-link CC to assigned CSP: If creating a CC for a ticker with an open position
        // from a CSP assignment, auto-link the CC to that CSP trade
        if (type === 'CC' && !parentTradeId) {
            const openPosition = db.prepare(`
                SELECT acquiredFromTradeId FROM positions
                WHERE ticker = ? AND soldDate IS NULL AND acquiredFromTradeId IS NOT NULL
                ORDER BY acquiredDate ASC
                LIMIT 1
            `).get(tickerUpper);

            if (openPosition && openPosition.acquiredFromTradeId) {
                resolvedParentTradeId = openPosition.acquiredFromTradeId;
                console.log(`🔗 Auto-linking CC to CSP trade #${resolvedParentTradeId} for ${tickerUpper}`);
            }
        }

        const stmt = db.prepare(`
      INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            tickerUpper,
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
            resolvedParentTradeId
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
        // Get current trade first to use as fallback values
        const currentTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
        if (!currentTrade) {
            return apiResponse.error(res, 'Trade not found', 404);
        }

        // Use request body values or fall back to current trade values
        const ticker = req.body.ticker ?? currentTrade.ticker;
        const type = req.body.type ?? currentTrade.type;
        const strike = req.body.strike ?? currentTrade.strike;
        const quantity = req.body.quantity ?? currentTrade.quantity;
        const delta = req.body.delta ?? currentTrade.delta;
        const entryPrice = req.body.entryPrice ?? currentTrade.entryPrice;
        const closePrice = req.body.closePrice ?? currentTrade.closePrice;
        const openedDate = req.body.openedDate ?? currentTrade.openedDate;
        const expirationDate = req.body.expirationDate ?? currentTrade.expirationDate;
        const closedDate = req.body.closedDate ?? currentTrade.closedDate;
        const status = req.body.status ?? currentTrade.status;
        const parentTradeId = req.body.parentTradeId ?? currentTrade.parentTradeId;

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

        // Handle position creation/closing on assignment
        if (status === 'Assigned' && currentTrade.status !== 'Assigned') {
            const tickerUpper = ticker.toUpperCase();
            const shares = (quantity || 1) * 100;
            const assignmentDate = closedDate || new Date().toISOString().split('T')[0];

            if (type === 'CSP') {
                // CSP Assigned: Create new position (cost basis = strike - premium collected)
                const adjustedCostBasis = strike - entryPrice;
                db.prepare(`
                    INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId)
                    VALUES (?, ?, ?, ?, ?)
                `).run(tickerUpper, shares, adjustedCostBasis, assignmentDate, req.params.id);
                console.log(`📈 Position created: ${shares} shares of ${tickerUpper} at $${adjustedCostBasis.toFixed(2)} (strike $${strike} - premium $${entryPrice})`);
            } else if (type === 'CC') {
                // CC Assigned: Close oldest open position (FIFO)
                const openPosition = db.prepare(`
                    SELECT * FROM positions
                    WHERE ticker = ? AND soldDate IS NULL
                    ORDER BY acquiredDate ASC
                    LIMIT 1
                `).get(tickerUpper);

                if (openPosition) {
                    const capitalGainLoss = (strike - openPosition.costBasis) * openPosition.shares;
                    db.prepare(`
                        UPDATE positions
                        SET soldDate = ?, salePrice = ?, soldViaTradeId = ?, capitalGainLoss = ?, updatedAt = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(assignmentDate, strike, req.params.id, capitalGainLoss, openPosition.id);
                    console.log(`📉 Position closed: ${openPosition.shares} shares of ${tickerUpper} at $${strike} (G/L: $${capitalGainLoss})`);
                }
            }
        }

        apiResponse.success(res, updatedTrade);
    } catch (error) {
        console.error('Error updating trade:', error);
        apiResponse.error(res, 'Failed to update trade');
    }
});

// DELETE trade
app.delete('/api/trades/:id', (req, res) => {
    try {
        const tradeId = req.params.id;

        // Unlink child trades (set parentTradeId to NULL)
        db.prepare('UPDATE trades SET parentTradeId = NULL WHERE parentTradeId = ?').run(tradeId);

        // Unlink positions that reference this trade
        db.prepare('UPDATE positions SET acquiredFromTradeId = NULL WHERE acquiredFromTradeId = ?').run(tradeId);
        db.prepare('UPDATE positions SET soldViaTradeId = NULL WHERE soldViaTradeId = ?').run(tradeId);

        // Delete the trade
        const result = db.prepare('DELETE FROM trades WHERE id = ?').run(tradeId);
        if (result.changes === 0) {
            return apiResponse.error(res, 'Trade not found', 404);
        }
        apiResponse.success(res, { deleted: true, id: parseInt(tradeId) });
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

        // Capital gains from positions
        const positionStats = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN soldDate IS NOT NULL THEN capitalGainLoss ELSE 0 END), 0) as realizedCapitalGL,
                COUNT(CASE WHEN soldDate IS NOT NULL THEN 1 END) as closedPositions,
                COUNT(CASE WHEN soldDate IS NULL THEN 1 END) as openPositions
            FROM positions
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
            bestTicker,
            // Capital gains from stock positions
            realizedCapitalGL: positionStats.realizedCapitalGL,
            openPositions: positionStats.openPositions,
            closedPositions: positionStats.closedPositions,
            totalPnLWithCapitalGains: mainStats.totalPnL + positionStats.realizedCapitalGL
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        apiResponse.error(res, 'Failed to fetch stats');
    }
});

// ============== v0.6.0: Positions API ==============

// GET positions summary (realized + unrealized gains) - MUST be before :id route
app.get('/api/positions/summary', (req, res) => {
    try {
        // Realized gains from closed positions
        const realizedStats = db.prepare(`
            SELECT
                COALESCE(SUM(capitalGainLoss), 0) as realizedGainLoss,
                COUNT(*) as closedPositions
            FROM positions
            WHERE soldDate IS NOT NULL
        `).get();

        // Open positions for unrealized calculation
        const openPositions = db.prepare(`
            SELECT * FROM positions WHERE soldDate IS NULL
        `).all();

        apiResponse.success(res, {
            realizedGainLoss: realizedStats.realizedGainLoss,
            closedPositions: realizedStats.closedPositions,
            openPositions: openPositions.length,
            openPositionsList: openPositions
        });
    } catch (error) {
        console.error('Error fetching positions summary:', error);
        apiResponse.error(res, 'Failed to fetch positions summary');
    }
});

// GET all positions
app.get('/api/positions', (req, res) => {
    try {
        const { status } = req.query;

        let query = 'SELECT * FROM positions';
        const params = [];

        if (status === 'open') {
            query += ' WHERE soldDate IS NULL';
        } else if (status === 'closed') {
            query += ' WHERE soldDate IS NOT NULL';
        }

        query += ' ORDER BY acquiredDate DESC';

        const positions = db.prepare(query).all(...params);
        apiResponse.success(res, positions);
    } catch (error) {
        console.error('Error fetching positions:', error);
        apiResponse.error(res, 'Failed to fetch positions');
    }
});

// GET single position
app.get('/api/positions/:id', (req, res) => {
    try {
        const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
        if (!position) {
            return apiResponse.error(res, 'Position not found', 404);
        }
        apiResponse.success(res, position);
    } catch (error) {
        console.error('Error fetching position:', error);
        apiResponse.error(res, 'Failed to fetch position');
    }
});

// POST create position (manual entry or from assignment)
app.post('/api/positions', (req, res) => {
    try {
        const { ticker, shares, costBasis, acquiredDate, acquiredFromTradeId } = req.body;

        const stmt = db.prepare(`
            INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            ticker.toUpperCase(),
            shares,
            costBasis,
            acquiredDate,
            acquiredFromTradeId || null
        );

        const newPosition = db.prepare('SELECT * FROM positions WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, newPosition);
    } catch (error) {
        console.error('Error creating position:', error);
        apiResponse.error(res, 'Failed to create position');
    }
});

// PUT close position (sell shares)
app.put('/api/positions/:id', (req, res) => {
    try {
        const { soldDate, salePrice, soldViaTradeId } = req.body;

        const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
        if (!position) {
            return apiResponse.error(res, 'Position not found', 404);
        }

        // Calculate capital gain/loss
        const capitalGainLoss = (salePrice - position.costBasis) * position.shares;

        const stmt = db.prepare(`
            UPDATE positions
            SET soldDate = ?, salePrice = ?, soldViaTradeId = ?, capitalGainLoss = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(soldDate, salePrice, soldViaTradeId || null, capitalGainLoss, req.params.id);

        const updatedPosition = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
        apiResponse.success(res, updatedPosition);
    } catch (error) {
        console.error('Error updating position:', error);
        apiResponse.error(res, 'Failed to update position');
    }
});

// DELETE position
app.delete('/api/positions/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM positions WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return apiResponse.error(res, 'Position not found', 404);
        }
        apiResponse.success(res, { deleted: true, id: parseInt(req.params.id) });
    } catch (error) {
        console.error('Error deleting position:', error);
        apiResponse.error(res, 'Failed to delete position');
    }
});

// ============== v0.6.0: Stock Prices API ==============

// GET stock price (with caching)
app.get('/api/prices/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase();

        // Check settings
        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('live_prices_enabled');
        if (!setting || setting.value !== 'true') {
            // Return cached price if available
            const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(ticker);
            if (cached) {
                return apiResponse.success(res, { ...cached, source: 'cache', live: false });
            }
            return apiResponse.error(res, 'Live prices disabled and no cached price available', 404);
        }

        // Try to fetch from external API
        try {
            // Try stocks endpoint first, then ETFs
            let response = await fetch(`https://stockprices.dev/api/stocks/${ticker}`);
            if (!response.ok) {
                response = await fetch(`https://stockprices.dev/api/etfs/${ticker}`);
            }

            if (response.ok) {
                const data = await response.json();

                // Update cache
                db.prepare(`
                    INSERT OR REPLACE INTO price_cache (ticker, price, change, changePercent, name, updatedAt)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(ticker, data.Price, data.ChangeAmount, data.ChangePercentage, data.Name);

                return apiResponse.success(res, {
                    ticker,
                    price: data.Price,
                    change: data.ChangeAmount,
                    changePercent: data.ChangePercentage,
                    name: data.Name,
                    source: 'live',
                    live: true
                });
            }
        } catch (fetchError) {
            console.error('Error fetching live price:', fetchError);
        }

        // Fallback to cache
        const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(ticker);
        if (cached) {
            return apiResponse.success(res, {
                ticker: cached.ticker,
                price: cached.price,
                change: cached.change,
                changePercent: cached.changePercent,
                name: cached.name,
                source: 'cache',
                live: false,
                cachedAt: cached.updatedAt
            });
        }

        apiResponse.error(res, 'Price not available', 404);
    } catch (error) {
        console.error('Error fetching price:', error);
        apiResponse.error(res, 'Failed to fetch price');
    }
});

// GET multiple stock prices
app.post('/api/prices/batch', async (req, res) => {
    try {
        const { tickers } = req.body;
        if (!Array.isArray(tickers) || tickers.length === 0) {
            return apiResponse.error(res, 'No tickers provided', 400);
        }

        const results = {};

        for (const ticker of tickers.slice(0, 20)) { // Limit to 20
            const t = ticker.toUpperCase();
            try {
                let response = await fetch(`https://stockprices.dev/api/stocks/${t}`);
                if (!response.ok) {
                    response = await fetch(`https://stockprices.dev/api/etfs/${t}`);
                }

                if (response.ok) {
                    const data = await response.json();
                    results[t] = {
                        price: data.Price,
                        change: data.ChangeAmount,
                        changePercent: data.ChangePercentage,
                        name: data.Name,
                        live: true
                    };

                    // Update cache
                    db.prepare(`
                        INSERT OR REPLACE INTO price_cache (ticker, price, change, changePercent, name, updatedAt)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(t, data.Price, data.ChangeAmount, data.ChangePercentage, data.Name);
                } else {
                    // Try cache
                    const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(t);
                    if (cached) {
                        results[t] = { ...cached, live: false };
                    }
                }
            } catch (e) {
                const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(t);
                if (cached) {
                    results[t] = { ...cached, live: false };
                }
            }
        }

        apiResponse.success(res, results);
    } catch (error) {
        console.error('Error fetching batch prices:', error);
        apiResponse.error(res, 'Failed to fetch prices');
    }
});

// ============== v0.6.0: Settings API ==============

// GET all settings
app.get('/api/settings', (req, res) => {
    try {
        const settings = db.prepare('SELECT * FROM settings').all();
        const settingsObj = Object.fromEntries(settings.map(s => [s.key, s.value]));
        apiResponse.success(res, settingsObj);
    } catch (error) {
        console.error('Error fetching settings:', error);
        apiResponse.error(res, 'Failed to fetch settings');
    }
});

// PUT update setting
app.put('/api/settings/:key', (req, res) => {
    try {
        const { value } = req.body;
        const key = req.params.key;

        db.prepare(`
            INSERT OR REPLACE INTO settings (key, value, updatedAt)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(key, value);

        apiResponse.success(res, { key, value });
    } catch (error) {
        console.error('Error updating setting:', error);
        apiResponse.error(res, 'Failed to update setting');
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

