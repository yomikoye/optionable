import { Router } from 'express';
import { db } from '../db/connection.js';
import { toDollars } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';

const router = Router();

// GET /api/portfolio/stats?accountId=X — Aggregate portfolio statistics
router.get('/stats', (req, res) => {
    try {
        const { accountId } = req.query;
        const acctWhere = accountId ? 'WHERE accountId = ?' : '';
        const acctAnd = accountId ? 'AND accountId = ?' : '';
        const acctParams = accountId ? [Number(accountId)] : [];

        // Fund transaction totals by type
        const fundSummary = db.prepare(`
            SELECT
                type,
                COALESCE(SUM(amount), 0) as total
            FROM fund_transactions
            ${acctWhere}
            GROUP BY type
        `).all(...acctParams);

        const fundTotals = {};
        for (const row of fundSummary) {
            fundTotals[row.type] = toDollars(row.total);
        }

        const deposits = fundTotals.deposit || 0;
        const withdrawals = fundTotals.withdrawal || 0;
        const dividends = fundTotals.dividend || 0;
        const interest = fundTotals.interest || 0;
        const fees = fundTotals.fee || 0;

        // Options P/L from trades — only realized (exclude Open trades where closePrice is 0)
        const optionsResult = db.prepare(`
            SELECT COALESCE(SUM((entryPrice - closePrice) * quantity * 100), 0) as totalPnL
            FROM trades
            WHERE status != 'Open' ${acctAnd}
        `).get(...acctParams);
        const optionsPnL = toDollars(optionsResult.totalPnL);

        // Realized stock gains from positions table (option assignments)
        const posGainsResult = db.prepare(`
            SELECT COALESCE(SUM(capitalGainLoss), 0) as gains
            FROM positions
            WHERE soldDate IS NOT NULL ${acctAnd}
        `).get(...acctParams);
        const positionGains = toDollars(posGainsResult.gains);

        // Realized stock gains from manual stocks table
        const stockGainsResult = db.prepare(`
            SELECT COALESCE(SUM(capitalGainLoss), 0) as gains
            FROM stocks
            WHERE soldDate IS NOT NULL ${acctAnd}
        `).get(...acctParams);
        const manualStockGains = toDollars(stockGainsResult.gains);

        const totalStockGains = positionGains + manualStockGains;

        // Cash balance = only fund transactions (deposits - withdrawals - fees + dividends + interest)
        // Options P/L and stock gains shown separately — not mixed in unless user has deposited
        const cashBalance = deposits - withdrawals - fees + dividends + interest;

        // Total P/L and rate of return
        const netDeposited = deposits - withdrawals;
        const totalPnL = optionsPnL + totalStockGains + dividends + interest - fees;
        const rateOfReturn = netDeposited > 0 ? (totalPnL / netDeposited) * 100 : 0;

        // Closed position counts
        const closedTradesCount = db.prepare(`
            SELECT COUNT(*) as count FROM trades
            WHERE status != 'Open' ${acctAnd}
        `).get(...acctParams).count;

        const closedStocksCount = db.prepare(`
            SELECT COUNT(*) as count FROM stocks
            WHERE soldDate IS NOT NULL ${acctAnd}
        `).get(...acctParams).count;

        const closedPosCount = db.prepare(`
            SELECT COUNT(*) as count FROM positions
            WHERE soldDate IS NOT NULL ${acctAnd}
        `).get(...acctParams).count;

        apiResponse.success(res, {
            netDeposited,
            totalDeposits: deposits,
            totalWithdrawals: withdrawals,
            totalPnL,
            rateOfReturn,
            optionsPnL,
            stockGains: totalStockGains,
            dividends,
            interest,
            fees,
            closedTradesCount,
            closedStockPositions: closedStocksCount + closedPosCount
        });
    } catch (error) {
        console.error('Error fetching portfolio stats:', error);
        apiResponse.error(res, 'Failed to fetch portfolio stats');
    }
});

// GET /api/portfolio/monthly?accountId=X — Monthly P/L breakdown by source
router.get('/monthly', (req, res) => {
    try {
        const { accountId } = req.query;
        const acctAnd = accountId ? 'AND accountId = ?' : '';
        const acctParams = accountId ? [Number(accountId)] : [];

        // Monthly options P/L (realized only)
        const monthlyOptions = db.prepare(`
            SELECT
                strftime('%Y-%m', COALESCE(closedDate, openedDate)) as month,
                SUM((entryPrice - closePrice) * quantity * 100) as pnl
            FROM trades
            WHERE status != 'Open' ${acctAnd}
            GROUP BY month
            ORDER BY month
        `).all(...acctParams);

        // Monthly stock gains (from positions + manual stocks)
        const monthlyPosGains = db.prepare(`
            SELECT
                strftime('%Y-%m', soldDate) as month,
                SUM(capitalGainLoss) as gains
            FROM positions
            WHERE soldDate IS NOT NULL ${acctAnd}
            GROUP BY month
        `).all(...acctParams);

        const monthlyStockGains = db.prepare(`
            SELECT
                strftime('%Y-%m', soldDate) as month,
                SUM(capitalGainLoss) as gains
            FROM stocks
            WHERE soldDate IS NOT NULL ${acctAnd}
            GROUP BY month
        `).all(...acctParams);

        // Monthly income (dividends + interest - fees)
        const monthlyIncome = db.prepare(`
            SELECT
                strftime('%Y-%m', date) as month,
                type,
                SUM(amount) as total
            FROM fund_transactions
            WHERE type IN ('dividend', 'interest', 'fee') ${acctAnd}
            GROUP BY month, type
            ORDER BY month
        `).all(...acctParams);

        // Merge all sources by month
        const months = new Map();

        const ensureMonth = (m) => {
            if (!months.has(m)) months.set(m, { month: m, options: 0, stocks: 0, income: 0 });
            return months.get(m);
        };

        for (const row of monthlyOptions) {
            ensureMonth(row.month).options = toDollars(row.pnl);
        }
        for (const row of monthlyPosGains) {
            ensureMonth(row.month).stocks += toDollars(row.gains);
        }
        for (const row of monthlyStockGains) {
            ensureMonth(row.month).stocks += toDollars(row.gains);
        }
        for (const row of monthlyIncome) {
            const entry = ensureMonth(row.month);
            if (row.type === 'fee') {
                entry.income -= toDollars(row.total);
            } else {
                entry.income += toDollars(row.total);
            }
        }

        const data = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));

        apiResponse.success(res, data);
    } catch (error) {
        console.error('Error fetching monthly portfolio data:', error);
        apiResponse.error(res, 'Failed to fetch monthly portfolio data');
    }
});

export default router;
