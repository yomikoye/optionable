import { Router } from 'express';
import { db } from '../db/connection.js';
import { apiResponse } from '../utils/response.js';
import { validateAccount } from '../utils/validation.js';

const router = Router();

// GET all accounts
router.get('/', (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM accounts ORDER BY id ASC').all();
        apiResponse.success(res, accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        apiResponse.error(res, 'Failed to fetch accounts');
    }
});

// GET single account
router.get('/:id', (req, res) => {
    try {
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return apiResponse.error(res, 'Account not found', 404);
        }
        apiResponse.success(res, account);
    } catch (error) {
        console.error('Error fetching account:', error);
        apiResponse.error(res, 'Failed to fetch account');
    }
});

// POST create account
router.post('/', (req, res) => {
    try {
        const validationErrors = validateAccount(req.body, false);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const result = db.prepare('INSERT INTO accounts (name) VALUES (?)').run(req.body.name.trim());
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, account);
    } catch (error) {
        console.error('Error creating account:', error);
        apiResponse.error(res, 'Failed to create account');
    }
});

// PUT rename account
router.put('/:id', (req, res) => {
    try {
        const validationErrors = validateAccount(req.body, true);
        if (validationErrors.length > 0) {
            return apiResponse.error(res, 'Validation failed', 400, validationErrors);
        }

        const result = db.prepare('UPDATE accounts SET name = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
            .run(req.body.name.trim(), req.params.id);

        if (result.changes === 0) {
            return apiResponse.error(res, 'Account not found', 404);
        }

        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
        apiResponse.success(res, account);
    } catch (error) {
        console.error('Error updating account:', error);
        apiResponse.error(res, 'Failed to update account');
    }
});

// DELETE account (only if no associated data)
router.delete('/:id', (req, res) => {
    try {
        const accountId = req.params.id;

        // Check for associated data across all tables
        const tradeCount = db.prepare('SELECT COUNT(*) as c FROM trades WHERE accountId = ?').get(accountId).c;
        const positionCount = db.prepare('SELECT COUNT(*) as c FROM positions WHERE accountId = ?').get(accountId).c;
        const fundCount = db.prepare('SELECT COUNT(*) as c FROM fund_transactions WHERE accountId = ?').get(accountId).c;
        const stockCount = db.prepare('SELECT COUNT(*) as c FROM stocks WHERE accountId = ?').get(accountId).c;

        const total = tradeCount + positionCount + fundCount + stockCount;
        if (total > 0) {
            return apiResponse.error(res,
                `Cannot delete account with existing data (${tradeCount} trades, ${positionCount} positions, ${fundCount} transactions, ${stockCount} stocks). Move or delete the data first.`,
                409
            );
        }

        const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
        if (result.changes === 0) {
            return apiResponse.error(res, 'Account not found', 404);
        }

        apiResponse.success(res, { deleted: true, id: parseInt(accountId) });
    } catch (error) {
        console.error('Error deleting account:', error);
        apiResponse.error(res, 'Failed to delete account');
    }
});

export default router;
