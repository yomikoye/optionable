import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCents, toDollars, stockToApi } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';
import { validateStock } from '../utils/validation.js';

const router = Router();

// GET all stocks
router.get('/', (req, res) => {
    try {
        const { accountId, status } = req.query;

        const conditions = [];
        const params = [];

        if (accountId) {
            conditions.push('accountId = ?');
            params.push(Number(accountId));
        }

        if (status === 'open') {
            conditions.push('soldDate IS NULL');
        } else if (status === 'closed') {
            conditions.push('soldDate IS NOT NULL');
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const stocks = db.prepare(
            `SELECT * FROM stocks ${whereClause} ORDER BY acquiredDate DESC, id DESC`
        ).all(...params);

        apiResponse.success(res, stocks.map(stockToApi));
    } catch (error) {
        console.error('Error fetching stocks:', error);
        apiResponse.error(res, 'Failed to fetch stocks');
    }
});

// GET single stock
router.get('/:id', (req, res) => {
    try {
        const stock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(req.params.id);
        if (!stock) {
            return apiResponse.error(res, 'Stock not found', 404);
        }
        apiResponse.success(res, stockToApi(stock));
    } catch (error) {
        console.error('Error fetching stock:', error);
        apiResponse.error(res, 'Failed to fetch stock');
    }
});

// POST create stock
router.post('/', (req, res) => {
    try {
        const validationErrors = validateStock(req.body, false);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const { accountId, ticker, shares, costBasis, acquiredDate, notes } = req.body;

        const result = db.prepare(`
            INSERT INTO stocks (accountId, ticker, shares, costBasis, acquiredDate, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            Number(accountId),
            ticker.toUpperCase(),
            Number(shares),
            toCents(costBasis),
            acquiredDate,
            notes || null
        );

        const stock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, stockToApi(stock));
    } catch (error) {
        console.error('Error creating stock:', error);
        apiResponse.error(res, 'Failed to create stock');
    }
});

// PUT update/sell stock
router.put('/:id', (req, res) => {
    try {
        const current = db.prepare('SELECT * FROM stocks WHERE id = ?').get(req.params.id);
        if (!current) {
            return apiResponse.error(res, 'Stock not found', 404);
        }

        const validationErrors = validateStock(req.body, true);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const ticker = req.body.ticker ? req.body.ticker.toUpperCase() : current.ticker;
        const shares = req.body.shares !== undefined ? Number(req.body.shares) : current.shares;
        const costBasis = req.body.costBasis !== undefined ? toCents(req.body.costBasis) : current.costBasis;
        const acquiredDate = req.body.acquiredDate ?? current.acquiredDate;
        const soldDate = req.body.soldDate !== undefined ? req.body.soldDate : current.soldDate;
        const salePrice = req.body.salePrice !== undefined ? (req.body.salePrice !== null ? toCents(req.body.salePrice) : null) : current.salePrice;
        const notes = req.body.notes !== undefined ? req.body.notes : current.notes;

        // Compute capital gain/loss when selling
        let capitalGainLoss = current.capitalGainLoss;
        if (soldDate && salePrice !== null) {
            const costBasisDollars = toDollars(costBasis);
            const salePriceDollars = toDollars(salePrice);
            capitalGainLoss = toCents((salePriceDollars - costBasisDollars) * shares);
        }

        db.prepare(`
            UPDATE stocks
            SET ticker = ?, shares = ?, costBasis = ?, acquiredDate = ?, soldDate = ?, salePrice = ?, capitalGainLoss = ?, notes = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(ticker, shares, costBasis, acquiredDate, soldDate, salePrice, capitalGainLoss, notes, req.params.id);

        const stock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(req.params.id);
        apiResponse.success(res, stockToApi(stock));
    } catch (error) {
        console.error('Error updating stock:', error);
        apiResponse.error(res, 'Failed to update stock');
    }
});

// DELETE stock
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM stocks WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return apiResponse.error(res, 'Stock not found', 404);
        }
        apiResponse.success(res, { deleted: true, id: parseInt(req.params.id) });
    } catch (error) {
        console.error('Error deleting stock:', error);
        apiResponse.error(res, 'Failed to delete stock');
    }
});

export default router;
