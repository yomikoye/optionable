import { db } from './connection.js';

// Migration: Fix existing positions cost basis to include premium collected
// Cost basis should be strike - premium, not just strike
export const fixCostBasis = () => {
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
};

// Clean up orphaned positions (positions whose originating trade was deleted)
export const cleanOrphanedPositions = () => {
    const orphanedPositions = db.prepare(`
        DELETE FROM positions
        WHERE acquiredFromTradeId IS NULL
    `).run();
    if (orphanedPositions.changes > 0) {
        console.log(`🧹 Cleaned up ${orphanedPositions.changes} orphaned position(s)`);
    }
};

// Seed example data if database is empty (for demo purposes)
// NOTE: All prices are in cents (e.g., $220 strike = 22000 cents)
export const seedDemoData = () => {
    const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get();
    if (tradeCount.count === 0) {
        console.log('Seeding example trades...');

        const insertTrade = db.prepare(`
            INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertPosition = db.prepare(`
            INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, soldDate, salePrice, soldViaTradeId, capitalGainLoss)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Example 1: AAPL - Simple CSP (expired worthless - ideal outcome)
        // Strike: $220, Premium: $2.80
        insertTrade.run('AAPL', 'CSP', 22000, 1, 0.25, 280, 0, '2025-11-18', '2025-12-20', '2025-12-20', 'Expired', null);

        // Example 2: MSFT - Simple CC (expired worthless - ideal outcome)
        // Strike: $450, Premium: $3.50
        insertTrade.run('MSFT', 'CC', 45000, 1, 0.30, 350, 0, '2025-11-20', '2025-12-20', '2025-12-20', 'Expired', null);

        // Example 3: META - Rolled CSP chain (rolled out and down for more premium)
        // Strike: $580, Premium: $4.20, Closed at: $6.50
        const metaRolled = insertTrade.run('META', 'CSP', 58000, 1, 0.28, 420, 650, '2025-11-15', '2025-12-20', '2025-12-18', 'Rolled', null);
        const metaRolledId = metaRolled.lastInsertRowid;

        // Strike: $560, Premium: $5.80
        insertTrade.run('META', 'CSP', 56000, 1, 0.25, 580, 0, '2025-12-18', '2026-01-17', null, 'Open', metaRolledId);

        // Example 4: NVDA - CSP Assigned then CC sold (full wheel cycle)
        // First: CSP was assigned (bought 100 shares at strike)
        // Strike: $130, Premium: $3.80
        const nvdaCsp = insertTrade.run('NVDA', 'CSP', 13000, 1, 0.32, 380, 0, '2025-11-10', '2025-12-06', '2025-12-06', 'Assigned', null);
        const nvdaCspId = nvdaCsp.lastInsertRowid;

        // Then: CC sold on the assigned shares - also assigned (shares called away at $140)
        // Strike: $140, Premium: $4.50
        const nvdaCc = insertTrade.run('NVDA', 'CC', 14000, 1, 0.28, 450, 0, '2025-12-09', '2025-12-20', '2025-12-20', 'Assigned', nvdaCspId);
        const nvdaCcId = nvdaCc.lastInsertRowid;

        // Position: Bought at $130 (CSP assigned) - $3.80 premium = $126.20 cost basis
        // Sold at $140 (CC assigned) = $1,380 gain (100 shares * ($140 - $126.20))
        // All values in cents
        insertPosition.run('NVDA', 100, 12620, '2025-12-06', nvdaCspId, '2025-12-20', 14000, nvdaCcId, 138000);

        console.log('Example trades seeded!');
    }
};
