import { Router } from 'express';
import { db } from '../db/connection.js';
import { toDollars } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';

const router = Router();

// GET stats/summary - Using SQL aggregations for performance
router.get('/', (req, res) => {
    try {
        const { accountId } = req.query;
        // Build account filter fragments
        const acctWhere = accountId ? 'WHERE accountId = ?' : '';
        const acctAnd = accountId ? 'AND accountId = ?' : '';
        const acctParams = accountId ? [Number(accountId)] : [];

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
            ${acctWhere}
        `).get(...acctParams);

        // Chain statistics - count roots and resolved chains
        const chainStats = db.prepare(`
            SELECT
                COUNT(*) as totalChains,
                COUNT(CASE WHEN status NOT IN ('Open', 'Rolled') THEN 1 END) as resolvedChains
            FROM trades
            WHERE parentTradeId IS NULL ${acctAnd}
        `).get(...acctParams);

        // Calculate chain P/L using recursive CTE (no N+1 queries)
        // Account filter only on base case (roots); children follow via parentTradeId
        const chainPnLStats = db.prepare(`
            WITH RECURSIVE chain_walk AS (
                -- Base: start from root trades (no parent)
                SELECT
                    id as root_id,
                    id as current_id,
                    (entryPrice - closePrice) * quantity * 100 as chain_pnl,
                    status as final_status
                FROM trades
                WHERE parentTradeId IS NULL ${acctAnd}

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
        `).get(...acctParams);

        const winningChains = chainPnLStats.winning_chains || 0;
        const resolvedCount = chainPnLStats.resolved_chains || 0;
        const winRate = resolvedCount > 0 ? (winningChains / resolvedCount) * 100 : 0;

        // Monthly P/L aggregation
        const monthlyStats = db.prepare(`
            SELECT
                strftime('%Y-%m', COALESCE(closedDate, openedDate)) as month,
                SUM((entryPrice - closePrice) * quantity * 100) as pnl
            FROM trades
            WHERE status NOT IN ('Open', 'Rolled') ${acctAnd}
            GROUP BY month
            ORDER BY month DESC
        `).all(...acctParams);

        // Ticker P/L aggregation
        const tickerStats = db.prepare(`
            SELECT
                ticker,
                SUM((entryPrice - closePrice) * quantity * 100) as pnl
            FROM trades
            ${acctWhere}
            GROUP BY ticker
            ORDER BY pnl DESC
        `).all(...acctParams);

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
            WHERE status NOT IN ('Open', 'Rolled') ${acctAnd}
        `).get(...acctParams);

        // Capital gains from positions
        const positionStats = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN soldDate IS NOT NULL THEN capitalGainLoss ELSE 0 END), 0) as realizedCapitalGL,
                COUNT(CASE WHEN soldDate IS NOT NULL THEN 1 END) as closedPositions,
                COUNT(CASE WHEN soldDate IS NULL THEN 1 END) as openPositions
            FROM positions
            ${acctWhere}
        `).get(...acctParams);

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

export default router;
