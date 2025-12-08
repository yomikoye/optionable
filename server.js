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

// Create trades table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('CSP', 'CC')),
    strike REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    entryPrice REAL NOT NULL,
    closePrice REAL DEFAULT 0,
    openedDate TEXT NOT NULL,
    expirationDate TEXT NOT NULL,
    closedDate TEXT,
    status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'Expired', 'Assigned', 'Closed')),
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

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
        const trades = db.prepare('SELECT * FROM trades ORDER BY openedDate DESC').all();
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
            entryPrice,
            closePrice,
            openedDate,
            expirationDate,
            closedDate,
            status
        } = req.body;

        const stmt = db.prepare(`
      INSERT INTO trades (ticker, type, strike, quantity, entryPrice, closePrice, openedDate, expirationDate, closedDate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            ticker.toUpperCase(),
            type,
            strike,
            quantity || 1,
            entryPrice,
            closePrice || 0,
            openedDate,
            expirationDate,
            closedDate || null,
            status || 'Open'
        );

        const newTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newTrade);
    } catch (error) {
        console.error('Error creating trade:', error);
        res.status(500).json({ error: 'Failed to create trade' });
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
            entryPrice,
            closePrice,
            openedDate,
            expirationDate,
            closedDate,
            status
        } = req.body;

        const stmt = db.prepare(`
      UPDATE trades 
      SET ticker = ?, type = ?, strike = ?, quantity = ?, entryPrice = ?, closePrice = ?, 
          openedDate = ?, expirationDate = ?, closedDate = ?, status = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

        const result = stmt.run(
            ticker.toUpperCase(),
            type,
            strike,
            quantity || 1,
            entryPrice,
            closePrice || 0,
            openedDate,
            expirationDate,
            closedDate || null,
            status || 'Open',
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

        // Calculate metrics for each trade
        const calculatePnL = (trade) => {
            const quantity = trade.quantity || 0;
            const entryPrice = trade.entryPrice || 0;
            const closePrice = trade.closePrice || 0;
            const totalPremium = entryPrice * quantity * 100;
            const totalCloseCost = closePrice * quantity * 100;
            return totalPremium - totalCloseCost;
        };

        const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t), 0);
        const totalTrades = trades.length;
        const winningTrades = trades.filter(t => calculatePnL(t) > 0).length;
        const totalAssigned = trades.filter(t => t.status === 'Assigned').length;
        const totalExpired = trades.filter(t => t.status === 'Expired').length;

        res.json({
            totalPnL,
            totalTrades,
            winningTrades,
            winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
            totalAssigned,
            totalExpired
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

