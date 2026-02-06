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

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');

// Foreign keys disabled during migrations, enabled after
db.pragma('foreign_keys = OFF');

// ============== Schema Versioning System ==============
// Each migration runs once, tracked by version number

db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
        description TEXT
    )
`);

const getSchemaVersion = () => {
    const result = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get();
    return result?.version || 0;
};

const setSchemaVersion = (version, description) => {
    db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(version, description);
};

// Define migrations in order
const migrations = [
    {
        version: 1,
        description: 'Initial trades table',
        up: () => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL CHECK(length(ticker) > 0),
                    type TEXT NOT NULL CHECK(type IN ('CSP', 'CC')),
                    strike INTEGER NOT NULL CHECK(strike > 0),
                    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 1),
                    delta REAL CHECK(delta IS NULL OR (delta >= 0 AND delta <= 1)),
                    entryPrice INTEGER NOT NULL CHECK(entryPrice >= 0),
                    closePrice INTEGER DEFAULT 0 CHECK(closePrice >= 0),
                    openedDate TEXT NOT NULL,
                    expirationDate TEXT NOT NULL,
                    closedDate TEXT,
                    status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'Expired', 'Assigned', 'Closed', 'Rolled')),
                    parentTradeId INTEGER REFERENCES trades(id) ON DELETE SET NULL,
                    notes TEXT,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    CHECK(expirationDate >= openedDate)
                )
            `);
        }
    },
    {
        version: 2,
        description: 'Positions table',
        up: () => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS positions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL CHECK(length(ticker) > 0),
                    shares INTEGER NOT NULL CHECK(shares >= 1),
                    costBasis INTEGER NOT NULL CHECK(costBasis >= 0),
                    acquiredDate TEXT NOT NULL,
                    acquiredFromTradeId INTEGER REFERENCES trades(id) ON DELETE CASCADE,
                    soldDate TEXT,
                    salePrice INTEGER CHECK(salePrice IS NULL OR salePrice >= 0),
                    soldViaTradeId INTEGER REFERENCES trades(id) ON DELETE SET NULL,
                    capitalGainLoss INTEGER,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
    },
    {
        version: 3,
        description: 'Price cache table',
        up: () => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS price_cache (
                    ticker TEXT PRIMARY KEY,
                    price INTEGER NOT NULL,
                    change INTEGER,
                    changePercent REAL,
                    name TEXT,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
    },
    {
        version: 4,
        description: 'Settings table',
        up: () => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('live_prices_enabled', 'true');
        }
    },
    {
        version: 5,
        description: 'Performance indexes',
        up: () => {
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
                CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
                CREATE INDEX IF NOT EXISTS idx_trades_openedDate ON trades(openedDate);
                CREATE INDEX IF NOT EXISTS idx_trades_expirationDate ON trades(expirationDate);
                CREATE INDEX IF NOT EXISTS idx_trades_closedDate ON trades(closedDate);
                CREATE INDEX IF NOT EXISTS idx_trades_parentTradeId ON trades(parentTradeId);
                CREATE INDEX IF NOT EXISTS idx_trades_status_openedDate ON trades(status, openedDate);
                CREATE INDEX IF NOT EXISTS idx_positions_ticker ON positions(ticker);
                CREATE INDEX IF NOT EXISTS idx_positions_soldDate ON positions(soldDate);
                CREATE INDEX IF NOT EXISTS idx_positions_acquiredFromTradeId ON positions(acquiredFromTradeId);
            `);
        }
    },
    {
        version: 6,
        description: 'Data integrity constraints',
        up: () => {
            // Skip if already migrated via settings
            const alreadyDone = db.prepare('SELECT value FROM settings WHERE key = ?').get('integrity_migration_v1');
            if (alreadyDone) return;

            db.pragma('foreign_keys = OFF');
            db.exec(`
                CREATE TABLE trades_integrity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL CHECK(length(ticker) > 0),
                    type TEXT NOT NULL CHECK(type IN ('CSP', 'CC')),
                    strike REAL NOT NULL CHECK(strike > 0),
                    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 1),
                    delta REAL CHECK(delta IS NULL OR (delta >= 0 AND delta <= 1)),
                    entryPrice REAL NOT NULL CHECK(entryPrice >= 0),
                    closePrice REAL DEFAULT 0 CHECK(closePrice >= 0),
                    openedDate TEXT NOT NULL,
                    expirationDate TEXT NOT NULL,
                    closedDate TEXT,
                    status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'Expired', 'Assigned', 'Closed', 'Rolled')),
                    parentTradeId INTEGER REFERENCES trades_integrity(id) ON DELETE SET NULL,
                    notes TEXT,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    CHECK(expirationDate >= openedDate)
                );
                INSERT INTO trades_integrity SELECT * FROM trades;
                DROP TABLE trades;
                ALTER TABLE trades_integrity RENAME TO trades;

                CREATE TABLE positions_integrity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL CHECK(length(ticker) > 0),
                    shares INTEGER NOT NULL CHECK(shares >= 1),
                    costBasis REAL NOT NULL CHECK(costBasis >= 0),
                    acquiredDate TEXT NOT NULL,
                    acquiredFromTradeId INTEGER REFERENCES trades(id) ON DELETE CASCADE,
                    soldDate TEXT,
                    salePrice REAL CHECK(salePrice IS NULL OR salePrice >= 0),
                    soldViaTradeId INTEGER REFERENCES trades(id) ON DELETE SET NULL,
                    capitalGainLoss REAL,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO positions_integrity SELECT * FROM positions;
                DROP TABLE positions;
                ALTER TABLE positions_integrity RENAME TO positions;
            `);
            db.exec(`
                CREATE INDEX idx_trades_status ON trades(status);
                CREATE INDEX idx_trades_ticker ON trades(ticker);
                CREATE INDEX idx_trades_openedDate ON trades(openedDate);
                CREATE INDEX idx_trades_expirationDate ON trades(expirationDate);
                CREATE INDEX idx_trades_closedDate ON trades(closedDate);
                CREATE INDEX idx_trades_parentTradeId ON trades(parentTradeId);
                CREATE INDEX idx_trades_status_openedDate ON trades(status, openedDate);
                CREATE INDEX idx_positions_ticker ON positions(ticker);
                CREATE INDEX idx_positions_soldDate ON positions(soldDate);
                CREATE INDEX idx_positions_acquiredFromTradeId ON positions(acquiredFromTradeId);
            `);
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('integrity_migration_v1', 'true');
        }
    },
    {
        version: 7,
        description: 'Prices to INTEGER cents',
        up: () => {
            // Skip if already migrated via settings
            const alreadyDone = db.prepare('SELECT value FROM settings WHERE key = ?').get('cents_migration_v1');
            if (alreadyDone) return;

            db.pragma('foreign_keys = OFF');
            db.exec(`
                CREATE TABLE trades_cents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL CHECK(length(ticker) > 0),
                    type TEXT NOT NULL CHECK(type IN ('CSP', 'CC')),
                    strike INTEGER NOT NULL CHECK(strike > 0),
                    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 1),
                    delta REAL CHECK(delta IS NULL OR (delta >= 0 AND delta <= 1)),
                    entryPrice INTEGER NOT NULL CHECK(entryPrice >= 0),
                    closePrice INTEGER DEFAULT 0 CHECK(closePrice >= 0),
                    openedDate TEXT NOT NULL,
                    expirationDate TEXT NOT NULL,
                    closedDate TEXT,
                    status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'Expired', 'Assigned', 'Closed', 'Rolled')),
                    parentTradeId INTEGER REFERENCES trades_cents(id) ON DELETE SET NULL,
                    notes TEXT,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    CHECK(expirationDate >= openedDate)
                );
                INSERT INTO trades_cents (id, ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId, notes, createdAt, updatedAt)
                SELECT id, ticker, type, CAST(ROUND(strike * 100) AS INTEGER), quantity, delta, CAST(ROUND(entryPrice * 100) AS INTEGER), CAST(ROUND(closePrice * 100) AS INTEGER), openedDate, expirationDate, closedDate, status, parentTradeId, notes, createdAt, updatedAt FROM trades;
                DROP TABLE trades;
                ALTER TABLE trades_cents RENAME TO trades;

                CREATE TABLE positions_cents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL CHECK(length(ticker) > 0),
                    shares INTEGER NOT NULL CHECK(shares >= 1),
                    costBasis INTEGER NOT NULL CHECK(costBasis >= 0),
                    acquiredDate TEXT NOT NULL,
                    acquiredFromTradeId INTEGER REFERENCES trades(id) ON DELETE CASCADE,
                    soldDate TEXT,
                    salePrice INTEGER CHECK(salePrice IS NULL OR salePrice >= 0),
                    soldViaTradeId INTEGER REFERENCES trades(id) ON DELETE SET NULL,
                    capitalGainLoss INTEGER,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO positions_cents (id, ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, soldDate, salePrice, soldViaTradeId, capitalGainLoss, createdAt, updatedAt)
                SELECT id, ticker, shares, CAST(ROUND(costBasis * 100) AS INTEGER), acquiredDate, acquiredFromTradeId, soldDate, CAST(ROUND(salePrice * 100) AS INTEGER), soldViaTradeId, CAST(ROUND(capitalGainLoss * 100) AS INTEGER), createdAt, updatedAt FROM positions;
                DROP TABLE positions;
                ALTER TABLE positions_cents RENAME TO positions;

                CREATE TABLE price_cache_cents (
                    ticker TEXT PRIMARY KEY,
                    price INTEGER NOT NULL,
                    change INTEGER,
                    changePercent REAL,
                    name TEXT,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO price_cache_cents (ticker, price, change, changePercent, name, updatedAt)
                SELECT ticker, CAST(ROUND(price * 100) AS INTEGER), CAST(ROUND(change * 100) AS INTEGER), changePercent, name, updatedAt FROM price_cache;
                DROP TABLE price_cache;
                ALTER TABLE price_cache_cents RENAME TO price_cache;
            `);
            db.exec(`
                CREATE INDEX idx_trades_status ON trades(status);
                CREATE INDEX idx_trades_ticker ON trades(ticker);
                CREATE INDEX idx_trades_openedDate ON trades(openedDate);
                CREATE INDEX idx_trades_expirationDate ON trades(expirationDate);
                CREATE INDEX idx_trades_closedDate ON trades(closedDate);
                CREATE INDEX idx_trades_parentTradeId ON trades(parentTradeId);
                CREATE INDEX idx_trades_status_openedDate ON trades(status, openedDate);
                CREATE INDEX idx_positions_ticker ON positions(ticker);
                CREATE INDEX idx_positions_soldDate ON positions(soldDate);
                CREATE INDEX idx_positions_acquiredFromTradeId ON positions(acquiredFromTradeId);
            `);
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('cents_migration_v1', 'true');
        }
    }
];

// Run pending migrations
const runMigrations = () => {
    const currentVersion = getSchemaVersion();
    const pending = migrations.filter(m => m.version > currentVersion);

    if (pending.length === 0) {
        console.log(`📊 Schema up to date (v${currentVersion})`);
        return;
    }

    console.log(`📊 Running ${pending.length} migration(s)...`);
    for (const m of pending) {
        console.log(`  → v${m.version}: ${m.description}`);
        m.up();
        setSchemaVersion(m.version, m.description);
    }
    console.log(`📊 Schema migrated to v${getSchemaVersion()}`);
};

// Handle legacy databases (pre-versioning)
// Only register base schema (1-5) so upgrade migrations (6-7) will run
const handleLegacyDb = () => {
    const tradesExist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trades'").get();
    const hasVersions = db.prepare('SELECT COUNT(*) as c FROM schema_migrations').get().c > 0;

    if (tradesExist && !hasVersions) {
        console.log('📊 Legacy database detected, registering existing schema...');
        const baseMigrations = migrations.filter(m => m.version <= 5);
        for (const m of baseMigrations) {
            setSchemaVersion(m.version, `${m.description} (legacy)`);
        }
    }
};

handleLegacyDb();
runMigrations();

// Re-enable foreign keys after migrations
db.pragma('foreign_keys = ON');

// All table creation and indexes now handled by schema versioning system above

// ============== Price Conversion Helpers ==============
// All prices stored as INTEGER cents, converted at API boundary

const toCents = (dollars) => {
    if (dollars === null || dollars === undefined) return null;
    return Math.round(Number(dollars) * 100);
};

const toDollars = (cents) => {
    if (cents === null || cents === undefined) return null;
    return cents / 100;
};

// Convert a trade object from DB (cents) to API (dollars)
const tradeToApi = (trade) => {
    if (!trade) return null;
    return {
        ...trade,
        strike: toDollars(trade.strike),
        entryPrice: toDollars(trade.entryPrice),
        closePrice: toDollars(trade.closePrice)
    };
};

// Convert a position object from DB (cents) to API (dollars)
const positionToApi = (position) => {
    if (!position) return null;
    return {
        ...position,
        costBasis: toDollars(position.costBasis),
        salePrice: toDollars(position.salePrice),
        capitalGainLoss: toDollars(position.capitalGainLoss)
    };
};

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

// Clean up orphaned positions (positions whose originating trade was deleted)
const orphanedPositions = db.prepare(`
    DELETE FROM positions
    WHERE acquiredFromTradeId IS NULL
`).run();
if (orphanedPositions.changes > 0) {
    console.log(`🧹 Cleaned up ${orphanedPositions.changes} orphaned position(s)`);
}

// Seed example data if database is empty (for demo purposes)
// NOTE: All prices are in cents (e.g., $220 strike = 22000 cents)
const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get();
if (tradeCount.count === 0) {
    console.log('Seeding example trades...');

    // Example 1: AAPL - Simple CSP (expired worthless - ideal outcome)
    // Strike: $220, Premium: $2.80
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('AAPL', 'CSP', 22000, 1, 0.25, 280, 0, '2025-11-18', '2025-12-20', '2025-12-20', 'Expired', NULL);
    `);

    // Example 2: MSFT - Simple CC (expired worthless - ideal outcome)
    // Strike: $450, Premium: $3.50
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('MSFT', 'CC', 45000, 1, 0.30, 350, 0, '2025-11-20', '2025-12-20', '2025-12-20', 'Expired', NULL);
    `);

    // Example 3: META - Rolled CSP chain (rolled out and down for more premium)
    // Strike: $580, Premium: $4.20, Closed at: $6.50
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('META', 'CSP', 58000, 1, 0.28, 420, 650, '2025-11-15', '2025-12-20', '2025-12-18', 'Rolled', NULL);
    `);
    const metaRolledId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    // Strike: $560, Premium: $5.80
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('META', 'CSP', 56000, 1, 0.25, 580, 0, '2025-12-18', '2026-01-17', NULL, 'Open', ${metaRolledId});
    `);

    // Example 4: NVDA - CSP Assigned then CC sold (full wheel cycle)
    // First: CSP was assigned (bought 100 shares at strike)
    // Strike: $130, Premium: $3.80
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('NVDA', 'CSP', 13000, 1, 0.32, 380, 0, '2025-11-10', '2025-12-06', '2025-12-06', 'Assigned', NULL);
    `);
    const nvdaCspId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    // Then: CC sold on the assigned shares - also assigned (shares called away at $140)
    // Strike: $140, Premium: $4.50
    db.exec(`
        INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
        VALUES ('NVDA', 'CC', 14000, 1, 0.28, 450, 0, '2025-12-09', '2025-12-20', '2025-12-20', 'Assigned', ${nvdaCspId});
    `);
    const nvdaCcId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    // Position: Bought at $130 (CSP assigned) - $3.80 premium = $126.20 cost basis
    // Sold at $140 (CC assigned) = $1,380 gain (100 shares * ($140 - $126.20))
    // All values in cents
    db.exec(`
        INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, soldDate, salePrice, soldViaTradeId, capitalGainLoss)
        VALUES ('NVDA', 100, 12620, '2025-12-06', ${nvdaCspId}, '2025-12-20', 14000, ${nvdaCcId}, 138000);
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

// ============== Input Validation ==============
const VALID_TYPES = ['CSP', 'CC'];
const VALID_STATUSES = ['Open', 'Expired', 'Assigned', 'Closed', 'Rolled'];

const validateTrade = (trade, isUpdate = false) => {
    const errors = [];

    // Required fields (only for create, not update)
    if (!isUpdate) {
        if (!trade.ticker || typeof trade.ticker !== 'string' || trade.ticker.trim() === '') {
            errors.push('ticker is required');
        }
        if (!trade.type) errors.push('type is required');
        if (trade.strike === undefined || trade.strike === null) errors.push('strike is required');
        if (trade.entryPrice === undefined || trade.entryPrice === null) errors.push('entryPrice is required');
        if (!trade.openedDate) errors.push('openedDate is required');
        if (!trade.expirationDate) errors.push('expirationDate is required');
    }

    // Type validation
    if (trade.type !== undefined && !VALID_TYPES.includes(trade.type)) {
        errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // Status validation
    if (trade.status !== undefined && !VALID_STATUSES.includes(trade.status)) {
        errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Numeric validations
    if (trade.strike !== undefined && trade.strike !== null) {
        const strike = Number(trade.strike);
        if (isNaN(strike) || strike <= 0) errors.push('strike must be a positive number');
    }

    if (trade.quantity !== undefined && trade.quantity !== null) {
        const qty = Number(trade.quantity);
        if (isNaN(qty) || qty < 1 || !Number.isInteger(qty)) errors.push('quantity must be a positive integer');
    }

    if (trade.entryPrice !== undefined && trade.entryPrice !== null) {
        const price = Number(trade.entryPrice);
        if (isNaN(price) || price < 0) errors.push('entryPrice must be a non-negative number');
    }

    if (trade.closePrice !== undefined && trade.closePrice !== null) {
        const price = Number(trade.closePrice);
        if (isNaN(price) || price < 0) errors.push('closePrice must be a non-negative number');
    }

    if (trade.delta !== undefined && trade.delta !== null && trade.delta !== '') {
        const delta = Number(trade.delta);
        if (isNaN(delta) || delta < 0 || delta > 1) errors.push('delta must be between 0 and 1');
    }

    // Date validations
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (trade.openedDate !== undefined && trade.openedDate !== null) {
        if (!dateRegex.test(trade.openedDate)) errors.push('openedDate must be in YYYY-MM-DD format');
    }

    if (trade.expirationDate !== undefined && trade.expirationDate !== null) {
        if (!dateRegex.test(trade.expirationDate)) errors.push('expirationDate must be in YYYY-MM-DD format');
    }

    if (trade.closedDate !== undefined && trade.closedDate !== null && trade.closedDate !== '') {
        if (!dateRegex.test(trade.closedDate)) errors.push('closedDate must be in YYYY-MM-DD format');
    }

    // Date logic: expiration should be >= opened
    if (trade.openedDate && trade.expirationDate && trade.openedDate > trade.expirationDate) {
        errors.push('expirationDate must be on or after openedDate');
    }

    return errors;
};

const validatePosition = (position, isUpdate = false) => {
    const errors = [];

    if (!isUpdate) {
        if (!position.ticker || typeof position.ticker !== 'string') errors.push('ticker is required');
        if (position.shares === undefined) errors.push('shares is required');
        if (position.costBasis === undefined) errors.push('costBasis is required');
        if (!position.acquiredDate) errors.push('acquiredDate is required');
    }

    if (position.shares !== undefined) {
        const shares = Number(position.shares);
        if (isNaN(shares) || shares < 1 || !Number.isInteger(shares)) errors.push('shares must be a positive integer');
    }

    if (position.costBasis !== undefined) {
        const cost = Number(position.costBasis);
        if (isNaN(cost) || cost < 0) errors.push('costBasis must be a non-negative number');
    }

    if (position.salePrice !== undefined && position.salePrice !== null) {
        const price = Number(position.salePrice);
        if (isNaN(price) || price < 0) errors.push('salePrice must be a non-negative number');
    }

    return errors;
};

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
            version: process.env.npm_package_version || '0.9.0'
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

        apiResponse.success(res, trades.map(tradeToApi), {
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
        apiResponse.success(res, tradeToApi(trade));
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
            parentTradeId,
            notes
        } = req.body;

        // Validate input
        const validationErrors = validateTrade(req.body, false);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

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
      INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            tickerUpper,
            type,
            toCents(strike),
            quantity || 1,
            delta || null,
            toCents(entryPrice),
            toCents(closePrice) || 0,
            openedDate,
            expirationDate,
            closedDate || null,
            status || 'Open',
            resolvedParentTradeId,
            notes || null
        );

        const newTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, tradeToApi(newTrade));
    } catch (error) {
        console.error('Error creating trade:', error);
        apiResponse.error(res, 'Failed to create trade');
    }
});

// POST roll trade (atomic: close original + create new)
app.post('/api/trades/roll', (req, res) => {
    try {
        const { originalTradeId, closePrice, newTrade } = req.body;

        if (!originalTradeId || closePrice === undefined || !newTrade) {
            return apiResponse.error(res, 'Missing required fields: originalTradeId, closePrice, newTrade', 400);
        }

        // Validate closePrice
        const closePriceNum = Number(closePrice);
        if (isNaN(closePriceNum) || closePriceNum < 0) {
            return apiResponse.error(res, 'Validation failed', 400, ['closePrice must be a non-negative number']);
        }

        // Validate the new trade data
        const validationErrors = validateTrade(newTrade, false);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const original = db.prepare('SELECT * FROM trades WHERE id = ?').get(originalTradeId);
        if (!original) {
            return apiResponse.error(res, 'Original trade not found', 404);
        }

        const rollTransaction = db.transaction(() => {
            // Close original trade as Rolled
            db.prepare(`
                UPDATE trades
                SET closePrice = ?, closedDate = ?, status = 'Rolled', updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(toCents(closePrice), newTrade.openedDate, originalTradeId);

            // Create new rolled trade
            const result = db.prepare(`
                INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                original.ticker,
                newTrade.type || original.type,
                toCents(newTrade.strike),
                newTrade.quantity || original.quantity,
                newTrade.delta || null,
                toCents(newTrade.entryPrice),
                toCents(newTrade.closePrice) || 0,
                newTrade.openedDate,
                newTrade.expirationDate,
                newTrade.closedDate || null,
                newTrade.status || 'Open',
                originalTradeId,
                newTrade.notes || null
            );

            return result.lastInsertRowid;
        });

        const newTradeId = rollTransaction();
        const createdTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(newTradeId);
        apiResponse.created(res, tradeToApi(createdTrade));
    } catch (error) {
        console.error('Error rolling trade:', error);
        apiResponse.error(res, 'Failed to roll trade');
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
            INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((trades) => {
            let imported = 0;
            const idMap = new Map(); // old ID → new ID

            // Insert trades in dependency order (parents before children)
            const remaining = [...trades];
            let lastCount = -1;
            while (remaining.length > 0 && remaining.length !== lastCount) {
                lastCount = remaining.length;
                for (let i = remaining.length - 1; i >= 0; i--) {
                    const trade = remaining[i];
                    const oldParentId = trade.parentTradeId ? Number(trade.parentTradeId) : null;

                    // Skip if parent hasn't been inserted yet
                    if (oldParentId && !idMap.has(oldParentId)) continue;

                    try {
                        const newParentId = oldParentId ? (idMap.get(oldParentId) || null) : null;
                        const result = stmt.run(
                            trade.ticker?.toUpperCase(),
                            trade.type,
                            toCents(trade.strike),
                            trade.quantity || 1,
                            trade.delta || null,
                            toCents(trade.entryPrice),
                            toCents(trade.closePrice) || 0,
                            trade.openedDate,
                            trade.expirationDate,
                            trade.closedDate || null,
                            trade.status || 'Open',
                            newParentId,
                            trade.notes || null
                        );
                        if (trade.id) idMap.set(Number(trade.id), result.lastInsertRowid);
                        imported++;
                    } catch (e) {
                        console.error('Error importing trade:', e, trade);
                    }
                    remaining.splice(i, 1);
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

        // Validate input (partial validation for updates)
        const validationErrors = validateTrade(req.body, true);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        // Use request body values (dollars) or fall back to current trade values (convert from cents)
        const ticker = req.body.ticker ?? currentTrade.ticker;
        const type = req.body.type ?? currentTrade.type;
        const strike = req.body.strike ?? toDollars(currentTrade.strike);
        const quantity = req.body.quantity ?? currentTrade.quantity;
        const delta = req.body.delta ?? currentTrade.delta;
        const entryPrice = req.body.entryPrice ?? toDollars(currentTrade.entryPrice);
        const closePrice = req.body.closePrice ?? toDollars(currentTrade.closePrice);
        const openedDate = req.body.openedDate ?? currentTrade.openedDate;
        const expirationDate = req.body.expirationDate ?? currentTrade.expirationDate;
        const closedDate = req.body.closedDate ?? currentTrade.closedDate;
        const status = req.body.status ?? currentTrade.status;
        const parentTradeId = req.body.parentTradeId ?? currentTrade.parentTradeId;
        const notes = req.body.notes ?? currentTrade.notes;

        const stmt = db.prepare(`
      UPDATE trades
      SET ticker = ?, type = ?, strike = ?, quantity = ?, delta = ?, entryPrice = ?, closePrice = ?,
          openedDate = ?, expirationDate = ?, closedDate = ?, status = ?, parentTradeId = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

        const result = stmt.run(
            ticker.toUpperCase(),
            type,
            toCents(strike),
            quantity || 1,
            delta || null,
            toCents(entryPrice),
            toCents(closePrice) || 0,
            openedDate,
            expirationDate,
            closedDate || null,
            status || 'Open',
            parentTradeId || null,
            notes || null,
            req.params.id
        );

        if (result.changes === 0) {
            return apiResponse.error(res, 'Trade not found', 404);
        }

        const updatedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
        const updatedTradeApi = tradeToApi(updatedTrade);

        // Handle position creation/closing on assignment
        if (status === 'Assigned' && currentTrade.status !== 'Assigned') {
            const tickerUpper = ticker.toUpperCase();
            const shares = (quantity || 1) * 100;
            const assignmentDate = closedDate || new Date().toISOString().split('T')[0];

            if (type === 'CSP') {
                // CSP Assigned: Create new position (cost basis = strike - premium collected)
                const adjustedCostBasis = strike - entryPrice; // in dollars
                db.prepare(`
                    INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId)
                    VALUES (?, ?, ?, ?, ?)
                `).run(tickerUpper, shares, toCents(adjustedCostBasis), assignmentDate, req.params.id);
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
                    // openPosition.costBasis is in cents, convert to dollars for calculation
                    const costBasisDollars = toDollars(openPosition.costBasis);
                    const capitalGainLoss = (strike - costBasisDollars) * openPosition.shares; // in dollars
                    db.prepare(`
                        UPDATE positions
                        SET soldDate = ?, salePrice = ?, soldViaTradeId = ?, capitalGainLoss = ?, updatedAt = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(assignmentDate, toCents(strike), req.params.id, toCents(capitalGainLoss), openPosition.id);
                    console.log(`📉 Position closed: ${openPosition.shares} shares of ${tickerUpper} at $${strike} (G/L: $${capitalGainLoss})`);
                }
            }
        }

        apiResponse.success(res, updatedTradeApi);
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

        // Delete positions that were created by this trade (CSP assignment)
        const deletedPositions = db.prepare('DELETE FROM positions WHERE acquiredFromTradeId = ?').run(tradeId);
        if (deletedPositions.changes > 0) {
            console.log(`🗑️ Deleted ${deletedPositions.changes} position(s) created by trade ${tradeId}`);
        }

        // Reset positions that were sold via this trade (CC assignment) - make them open again
        const resetPositions = db.prepare(`
            UPDATE positions
            SET soldDate = NULL, salePrice = NULL, soldViaTradeId = NULL, capitalGainLoss = NULL, updatedAt = CURRENT_TIMESTAMP
            WHERE soldViaTradeId = ?
        `).run(tradeId);
        if (resetPositions.changes > 0) {
            console.log(`↩️ Reset ${resetPositions.changes} position(s) sold via trade ${tradeId}`);
        }

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

        // Calculate chain P/L using recursive CTE (no N+1 queries)
        const chainPnLStats = db.prepare(`
            WITH RECURSIVE chain_walk AS (
                -- Base: start from root trades (no parent)
                SELECT
                    id as root_id,
                    id as current_id,
                    (entryPrice - closePrice) * quantity * 100 as chain_pnl,
                    status as final_status
                FROM trades
                WHERE parentTradeId IS NULL

                UNION ALL

                -- Recursive: follow children
                SELECT
                    cw.root_id,
                    t.id as current_id,
                    cw.chain_pnl + (t.entryPrice - t.closePrice) * t.quantity * 100,
                    t.status as final_status
                FROM chain_walk cw
                JOIN trades t ON t.parentTradeId = cw.current_id
            ),
            -- Get final state of each chain (last trade in chain)
            chain_finals AS (
                SELECT root_id, chain_pnl, final_status
                FROM chain_walk cw
                WHERE NOT EXISTS (
                    SELECT 1 FROM trades t WHERE t.parentTradeId = cw.current_id
                )
            )
            SELECT
                COUNT(CASE WHEN final_status NOT IN ('Open', 'Rolled') AND chain_pnl > 0 THEN 1 END) as winning_chains,
                COUNT(CASE WHEN final_status NOT IN ('Open', 'Rolled') THEN 1 END) as resolved_chains
            FROM chain_finals
        `).get();

        const winningChains = chainPnLStats.winning_chains || 0;
        const resolvedCount = chainPnLStats.resolved_chains || 0;
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

        // Convert all money values from cents to dollars
        apiResponse.success(res, {
            totalPnL: toDollars(mainStats.totalPnL),
            totalPremiumCollected: toDollars(mainStats.totalPremium),
            totalTrades: mainStats.totalTrades,
            openTradesCount: mainStats.openCount,
            completedTradesCount: mainStats.expiredCount + mainStats.assignedCount + mainStats.closedCount,
            capitalAtRisk: toDollars(mainStats.capitalAtRisk),
            winningChains,
            totalChains: chainStats.totalChains,
            resolvedChains: resolvedCount,
            winRate,
            avgRoi: avgRoiResult.avgRoi || 0,
            totalAssigned: mainStats.assignedCount,
            totalExpired: mainStats.expiredCount,
            totalRolled: mainStats.rolledCount,
            monthlyStats: Object.fromEntries(monthlyStats.map(m => [m.month, toDollars(m.pnl)])),
            tickerStats: Object.fromEntries(tickerStats.map(t => [t.ticker, toDollars(t.pnl)])),
            bestTicker: bestTicker ? { ...bestTicker, pnl: toDollars(bestTicker.pnl) } : null,
            // Capital gains from stock positions
            realizedCapitalGL: toDollars(positionStats.realizedCapitalGL),
            openPositions: positionStats.openPositions,
            closedPositions: positionStats.closedPositions,
            totalPnLWithCapitalGains: toDollars(mainStats.totalPnL + positionStats.realizedCapitalGL)
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
            realizedGainLoss: toDollars(realizedStats.realizedGainLoss),
            closedPositions: realizedStats.closedPositions,
            openPositions: openPositions.length,
            openPositionsList: openPositions.map(positionToApi)
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
        apiResponse.success(res, positions.map(positionToApi));
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
        apiResponse.success(res, positionToApi(position));
    } catch (error) {
        console.error('Error fetching position:', error);
        apiResponse.error(res, 'Failed to fetch position');
    }
});

// POST create position (manual entry or from assignment)
app.post('/api/positions', (req, res) => {
    try {
        const { ticker, shares, costBasis, acquiredDate, acquiredFromTradeId } = req.body;

        // Validate input
        const validationErrors = validatePosition(req.body, false);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const stmt = db.prepare(`
            INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            ticker.toUpperCase(),
            shares,
            toCents(costBasis),
            acquiredDate,
            acquiredFromTradeId || null
        );

        const newPosition = db.prepare('SELECT * FROM positions WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, positionToApi(newPosition));
    } catch (error) {
        console.error('Error creating position:', error);
        apiResponse.error(res, 'Failed to create position');
    }
});

// PUT close position (sell shares)
app.put('/api/positions/:id', (req, res) => {
    try {
        const { soldDate, salePrice, soldViaTradeId } = req.body;

        // Validate input
        const validationErrors = validatePosition(req.body, true);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
        if (!position) {
            return apiResponse.error(res, 'Position not found', 404);
        }

        // Calculate capital gain/loss (salePrice is dollars from frontend, costBasis is cents in DB)
        const costBasisDollars = toDollars(position.costBasis);
        const capitalGainLoss = (salePrice - costBasisDollars) * position.shares;

        const stmt = db.prepare(`
            UPDATE positions
            SET soldDate = ?, salePrice = ?, soldViaTradeId = ?, capitalGainLoss = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(soldDate, toCents(salePrice), soldViaTradeId || null, toCents(capitalGainLoss), req.params.id);

        const updatedPosition = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
        apiResponse.success(res, positionToApi(updatedPosition));
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
            // Return cached price if available (convert from cents to dollars)
            const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(ticker);
            if (cached) {
                return apiResponse.success(res, {
                    ...cached,
                    price: toDollars(cached.price),
                    change: toDollars(cached.change),
                    source: 'cache',
                    live: false
                });
            }
            return apiResponse.error(res, 'Live prices disabled and no cached price available', 404);
        }

        // Try to fetch from external API
        try {
            // Try stocks endpoint first, then ETFs
            let response = await fetch(`https://stockprices.dev/api/stocks/${ticker}`, { signal: AbortSignal.timeout(5000) });
            if (!response.ok) {
                response = await fetch(`https://stockprices.dev/api/etfs/${ticker}`, { signal: AbortSignal.timeout(5000) });
            }

            if (response.ok) {
                const data = await response.json();

                // Update cache (store as cents)
                db.prepare(`
                    INSERT OR REPLACE INTO price_cache (ticker, price, change, changePercent, name, updatedAt)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(ticker, toCents(data.Price), toCents(data.ChangeAmount), data.ChangePercentage, data.Name);

                // Return live price (already in dollars from API)
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

        // Fallback to cache (convert from cents to dollars)
        const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(ticker);
        if (cached) {
            return apiResponse.success(res, {
                ticker: cached.ticker,
                price: toDollars(cached.price),
                change: toDollars(cached.change),
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

        // Check if live prices are enabled
        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('live_prices_enabled');
        const livePricesEnabled = setting && setting.value === 'true';

        const uniqueTickers = [...new Set(tickers.slice(0, 20).map(t => t.toUpperCase()))];

        // If live prices disabled, return cached prices only (convert from cents to dollars)
        if (!livePricesEnabled) {
            const results = {};
            for (const t of uniqueTickers) {
                const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(t);
                if (cached) {
                    results[t] = {
                        ...cached,
                        price: toDollars(cached.price),
                        change: toDollars(cached.change),
                        live: false
                    };
                }
            }
            return apiResponse.success(res, results);
        }

        // Fetch all prices concurrently with Promise.all()
        const fetchPrice = async (ticker) => {
            try {
                let response = await fetch(`https://stockprices.dev/api/stocks/${ticker}`, { signal: AbortSignal.timeout(5000) });
                if (!response.ok) {
                    response = await fetch(`https://stockprices.dev/api/etfs/${ticker}`, { signal: AbortSignal.timeout(5000) });
                }

                if (response.ok) {
                    const data = await response.json();
                    // Update cache (store as cents)
                    db.prepare(`
                        INSERT OR REPLACE INTO price_cache (ticker, price, change, changePercent, name, updatedAt)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(ticker, toCents(data.Price), toCents(data.ChangeAmount), data.ChangePercentage, data.Name);

                    // Return live price (already in dollars from API)
                    return {
                        ticker,
                        data: {
                            price: data.Price,
                            change: data.ChangeAmount,
                            changePercent: data.ChangePercentage,
                            name: data.Name,
                            live: true
                        }
                    };
                }
            } catch (e) {
                // Fall through to cache
            }

            // Fallback to cache (convert from cents to dollars)
            const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(ticker);
            if (cached) {
                return {
                    ticker,
                    data: {
                        ...cached,
                        price: toDollars(cached.price),
                        change: toDollars(cached.change),
                        live: false
                    }
                };
            }
            return { ticker, data: null };
        };

        const priceResults = await Promise.all(uniqueTickers.map(fetchPrice));

        const results = {};
        for (const { ticker, data } of priceResults) {
            if (data) {
                results[ticker] = data;
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

