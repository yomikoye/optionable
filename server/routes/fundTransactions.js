import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCents, fundTransactionToApi } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';
import { validateFundTransaction } from '../utils/validation.js';

const router = Router();

// GET all fund transactions
router.get('/', (req, res) => {
    try {
        const { accountId, type } = req.query;

        const conditions = [];
        const params = [];

        if (accountId) {
            conditions.push('accountId = ?');
            params.push(Number(accountId));
        }

        if (type) {
            conditions.push('type = ?');
            params.push(type);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const transactions = db.prepare(
            `SELECT * FROM fund_transactions ${whereClause} ORDER BY date DESC, id DESC`
        ).all(...params);

        apiResponse.success(res, transactions.map(fundTransactionToApi));
    } catch (error) {
        console.error('Error fetching fund transactions:', error);
        apiResponse.error(res, 'Failed to fetch fund transactions');
    }
});

// GET single fund transaction
router.get('/:id', (req, res) => {
    try {
        const txn = db.prepare('SELECT * FROM fund_transactions WHERE id = ?').get(req.params.id);
        if (!txn) {
            return apiResponse.error(res, 'Fund transaction not found', 404);
        }
        apiResponse.success(res, fundTransactionToApi(txn));
    } catch (error) {
        console.error('Error fetching fund transaction:', error);
        apiResponse.error(res, 'Failed to fetch fund transaction');
    }
});

// POST create fund transaction
router.post('/', (req, res) => {
    try {
        const validationErrors = validateFundTransaction(req.body, false);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const { accountId, type, amount, date, description } = req.body;

        const result = db.prepare(`
            INSERT INTO fund_transactions (accountId, type, amount, date, description)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            Number(accountId),
            type,
            toCents(amount),
            date,
            description || null
        );

        const txn = db.prepare('SELECT * FROM fund_transactions WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, fundTransactionToApi(txn));
    } catch (error) {
        console.error('Error creating fund transaction:', error);
        apiResponse.error(res, 'Failed to create fund transaction');
    }
});

// PUT update fund transaction
router.put('/:id', (req, res) => {
    try {
        const current = db.prepare('SELECT * FROM fund_transactions WHERE id = ?').get(req.params.id);
        if (!current) {
            return apiResponse.error(res, 'Fund transaction not found', 404);
        }

        const validationErrors = validateFundTransaction(req.body, true);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const type = req.body.type ?? current.type;
        const amount = req.body.amount !== undefined ? toCents(req.body.amount) : current.amount;
        const date = req.body.date ?? current.date;
        const description = req.body.description !== undefined ? req.body.description : current.description;

        db.prepare(`
            UPDATE fund_transactions
            SET type = ?, amount = ?, date = ?, description = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(type, amount, date, description, req.params.id);

        const txn = db.prepare('SELECT * FROM fund_transactions WHERE id = ?').get(req.params.id);
        apiResponse.success(res, fundTransactionToApi(txn));
    } catch (error) {
        console.error('Error updating fund transaction:', error);
        apiResponse.error(res, 'Failed to update fund transaction');
    }
});

// DELETE fund transaction
router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM fund_transactions WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return apiResponse.error(res, 'Fund transaction not found', 404);
        }
        apiResponse.success(res, { deleted: true, id: parseInt(req.params.id) });
    } catch (error) {
        console.error('Error deleting fund transaction:', error);
        apiResponse.error(res, 'Failed to delete fund transaction');
    }
});

export default router;
