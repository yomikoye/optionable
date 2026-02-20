import { db } from './connection.js';

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
            // Ensure settings table exists (may not if legacy DB predates v4)
            db.exec(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('live_prices_enabled', 'true');

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
    },
    {
        version: 8,
        description: 'Multi-account support',
        up: () => {
            db.exec(`
                CREATE TABLE accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL CHECK(length(name) > 0),
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add accountId to existing tables (nullable for ALTER TABLE compat)
            db.exec(`
                ALTER TABLE trades ADD COLUMN accountId INTEGER REFERENCES accounts(id) ON DELETE RESTRICT;
                ALTER TABLE positions ADD COLUMN accountId INTEGER REFERENCES accounts(id) ON DELETE RESTRICT;
            `);
            db.exec(`
                CREATE INDEX idx_trades_accountId ON trades(accountId);
                CREATE INDEX idx_positions_accountId ON positions(accountId);
            `);

            // Backfill: create default account, assign all existing data
            db.prepare(`INSERT INTO accounts (name) VALUES (?)`).run('Default');
            const defaultAccount = db.prepare('SELECT id FROM accounts ORDER BY id LIMIT 1').get();
            db.prepare('UPDATE trades SET accountId = ?').run(defaultAccount.id);
            db.prepare('UPDATE positions SET accountId = ?').run(defaultAccount.id);

            // Portfolio mode setting
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('portfolio_mode_enabled', 'false');
        }
    },
    {
        version: 9,
        description: 'Fund transactions table',
        up: () => {
            db.exec(`
                CREATE TABLE fund_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    accountId INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                    type TEXT NOT NULL CHECK(type IN ('deposit','withdrawal','dividend','interest','fee')),
                    amount INTEGER NOT NULL CHECK(amount > 0),
                    date TEXT NOT NULL,
                    description TEXT,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX idx_fund_transactions_accountId ON fund_transactions(accountId);
                CREATE INDEX idx_fund_transactions_date ON fund_transactions(date);
            `);
        }
    },
    {
        version: 10,
        description: 'Manual stocks table',
        up: () => {
            db.exec(`
                CREATE TABLE stocks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    accountId INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                    ticker TEXT NOT NULL CHECK(length(ticker) > 0),
                    shares INTEGER NOT NULL CHECK(shares >= 1),
                    costBasis INTEGER NOT NULL CHECK(costBasis >= 0),
                    acquiredDate TEXT NOT NULL,
                    soldDate TEXT,
                    salePrice INTEGER CHECK(salePrice IS NULL OR salePrice >= 0),
                    capitalGainLoss INTEGER,
                    notes TEXT,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX idx_stocks_accountId ON stocks(accountId);
                CREATE INDEX idx_stocks_ticker ON stocks(ticker);
            `);
        }
    },
    {
        version: 11,
        description: 'Pagination settings',
        up: () => {
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('pagination_enabled', 'true');
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('trades_per_page', '5');
        }
    }
];

// Run pending migrations
export const runMigrations = () => {
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
export const handleLegacyDb = () => {
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
