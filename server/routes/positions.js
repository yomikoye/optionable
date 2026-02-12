import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCents, toDollars, positionToApi } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';
import { validatePosition } from '../utils/validation.js';

const router = Router();

// GET positions summary (realized + unrealized gains) - MUST be before :id route
router.get('/summary', (req, res) => {
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
router.get('/', (req, res) => {
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
router.get('/:id', (req, res) => {
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
router.post('/', (req, res) => {
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
router.put('/:id', (req, res) => {
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
router.delete('/:id', (req, res) => {
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

export default router;
