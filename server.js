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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, 'dist')));
}

// ============== API Routes ==============

// GET all trades
app.get('/api/trades', (req, res) => {
    try {
        const trades = db.prepare('SELECT * FROM trades ORDER BY openedDate ASC, id ASC').all();
        res.json(trades);
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// GET single trade
app.get('/api/trades/:id', (req, res) => {
    try {
        const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }
        res.json(trade);
    } catch (error) {
        console.error('Error fetching trade:', error);
        res.status(500).json({ error: 'Failed to fetch trade' });
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
        res.status(201).json(newTrade);
    } catch (error) {
        console.error('Error creating trade:', error);
        res.status(500).json({ error: 'Failed to create trade' });
    }
});

// POST bulk import trades
app.post('/api/trades/import', (req, res) => {
    try {
        const { trades } = req.body;

        if (!Array.isArray(trades) || trades.length === 0) {
            return res.status(400).json({ error: 'No trades provided' });
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
        res.status(201).json({ imported, total: trades.length });
    } catch (error) {
        console.error('Error importing trades:', error);
        res.status(500).json({ error: 'Failed to import trades' });
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
            return res.status(404).json({ error: 'Trade not found' });
        }

        const updatedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
        res.json(updatedTrade);
    } catch (error) {
        console.error('Error updating trade:', error);
        res.status(500).json({ error: 'Failed to update trade' });
    }
});

// DELETE trade
app.delete('/api/trades/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM trades WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Trade not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting trade:', error);
        res.status(500).json({ error: 'Failed to delete trade' });
    }
});

// GET stats/summary
app.get('/api/stats', (req, res) => {
    try {
        const trades = db.prepare('SELECT * FROM trades').all();

        // Calculate P/L for a single trade
        const calculatePnL = (trade) => {
            const quantity = trade.quantity || 0;
            const entryPrice = trade.entryPrice || 0;
            const closePrice = trade.closePrice || 0;
            const totalPremium = entryPrice * quantity * 100;
            const totalCloseCost = closePrice * quantity * 100;
            return totalPremium - totalCloseCost;
        };

        // Build a map for quick lookup
        const tradeMap = new Map(trades.map(t => [t.id, t]));

        // Find all trades that are children (have a parent)
        const childTradeIds = new Set(trades.filter(t => t.parentTradeId).map(t => t.id));

        // Find chain roots: trades that have no parent AND are not a child of another trade
        // Actually, chain roots are trades where parentTradeId is null
        const chainRoots = trades.filter(t => !t.parentTradeId);

        // For each chain root, calculate the full chain P/L and determine if resolved
        const chains = chainRoots.map(root => {
            let chainPnL = 0;
            let currentTrade = root;
            let finalStatus = root.status;
            const chainTrades = [root];

            // Sum P/L for the root
            chainPnL += calculatePnL(root);

            // Find children (trades where parentTradeId points to current)
            // We need to follow the chain forward
            let childTrade = trades.find(t => t.parentTradeId === currentTrade.id);
            while (childTrade) {
                chainPnL += calculatePnL(childTrade);
                chainTrades.push(childTrade);
                finalStatus = childTrade.status;
                currentTrade = childTrade;
                childTrade = trades.find(t => t.parentTradeId === currentTrade.id);
            }

            return {
                rootId: root.id,
                chainPnL,
                finalStatus,
                tradeCount: chainTrades.length,
                isResolved: finalStatus !== 'Open' && finalStatus !== 'Rolled'
            };
        });

        // Calculate win rate based on resolved chains only
        const resolvedChains = chains.filter(c => c.isResolved);
        const winningChains = resolvedChains.filter(c => c.chainPnL > 0).length;
        const chainWinRate = resolvedChains.length > 0 ? (winningChains / resolvedChains.length) * 100 : 0;

        // Total P/L (all trades)
        const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t), 0);
        const totalTrades = trades.length;
        const totalAssigned = trades.filter(t => t.status === 'Assigned').length;
        const totalExpired = trades.filter(t => t.status === 'Expired').length;
        const totalRolled = trades.filter(t => t.status === 'Rolled').length;

        res.json({
            totalPnL,
            totalTrades,
            winningChains,
            totalChains: chainRoots.length,
            resolvedChains: resolvedChains.length,
            winRate: chainWinRate,
            totalAssigned,
            totalExpired,
            totalRolled
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
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

