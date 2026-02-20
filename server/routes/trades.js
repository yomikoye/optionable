import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCents, toDollars, tradeToApi } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';
import { validateTrade } from '../utils/validation.js';

const router = Router();

// POST roll trade (atomic: close original + create new) - MUST be before /:id
router.post('/roll', (req, res) => {
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

            // Create new rolled trade (inherit accountId from original)
            const result = db.prepare(`
                INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId, notes, accountId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                newTrade.notes || null,
                original.accountId
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

// POST bulk import trades - MUST be before /:id
router.post('/import', (req, res) => {
    try {
        const { trades, accountId } = req.body;

        if (!Array.isArray(trades) || trades.length === 0) {
            return apiResponse.error(res, 'No trades provided', 400);
        }

        const stmt = db.prepare(`
            INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId, notes, accountId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const dupCheck = db.prepare(`
            SELECT id FROM trades
            WHERE ticker = ? AND type = ? AND strike = ? AND quantity = ? AND entryPrice = ? AND openedDate = ? AND expirationDate = ?
              AND (accountId = ? OR (accountId IS NULL AND ? IS NULL))
            LIMIT 1
        `);

        const insertMany = db.transaction((trades) => {
            let imported = 0;
            let skipped = 0;
            const idMap = new Map(); // old ID → new ID
            const assignedTrades = []; // track assigned trades for position creation

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
                        const tradeAccountId = trade.accountId || accountId || null;

                        // Skip duplicates
                        const existing = dupCheck.get(
                            trade.ticker?.toUpperCase(), trade.type, toCents(trade.strike),
                            trade.quantity || 1, toCents(trade.entryPrice),
                            trade.openedDate, trade.expirationDate,
                            tradeAccountId, tradeAccountId
                        );
                        if (existing) {
                            if (trade.id) idMap.set(Number(trade.id), existing.id);
                            skipped++;
                            remaining.splice(i, 1);
                            continue;
                        }
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
                            trade.notes || null,
                            tradeAccountId
                        );
                        const newId = result.lastInsertRowid;
                        if (trade.id) idMap.set(Number(trade.id), newId);

                        // Track assigned trades to create positions after all inserts
                        if (trade.status === 'Assigned') {
                            assignedTrades.push({
                                id: newId,
                                ticker: trade.ticker?.toUpperCase(),
                                type: trade.type,
                                strike: Number(trade.strike),
                                entryPrice: Number(trade.entryPrice),
                                quantity: trade.quantity || 1,
                                closedDate: trade.closedDate,
                                accountId: tradeAccountId
                            });
                        }
                        imported++;
                    } catch (e) {
                        console.error('Error importing trade:', e, trade);
                    }
                    remaining.splice(i, 1);
                }
            }

            // Create positions for CSP Assigned trades, close positions for CC Assigned trades
            for (const trade of assignedTrades) {
                const shares = trade.quantity * 100;
                const assignmentDate = trade.closedDate || new Date().toISOString().split('T')[0];

                if (trade.type === 'CSP') {
                    const adjustedCostBasis = trade.strike - trade.entryPrice;
                    db.prepare(`
                        INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, accountId)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(trade.ticker, shares, toCents(adjustedCostBasis), assignmentDate, trade.id, trade.accountId);
                } else if (trade.type === 'CC') {
                    const openPosition = db.prepare(
                        trade.accountId
                            ? 'SELECT * FROM positions WHERE ticker = ? AND soldDate IS NULL AND accountId = ? ORDER BY acquiredDate ASC LIMIT 1'
                            : 'SELECT * FROM positions WHERE ticker = ? AND soldDate IS NULL ORDER BY acquiredDate ASC LIMIT 1'
                    ).get(...(trade.accountId ? [trade.ticker, trade.accountId] : [trade.ticker]));

                    if (openPosition) {
                        const costBasisDollars = toDollars(openPosition.costBasis);
                        const capitalGainLoss = (trade.strike - costBasisDollars) * openPosition.shares;
                        db.prepare(`
                            UPDATE positions
                            SET soldDate = ?, salePrice = ?, soldViaTradeId = ?, capitalGainLoss = ?, updatedAt = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).run(assignmentDate, toCents(trade.strike), trade.id, toCents(capitalGainLoss), openPosition.id);
                    }
                }
            }

            return { imported, skipped };
        });

        const result = insertMany(trades);
        apiResponse.created(res, { imported: result.imported, skipped: result.skipped, total: trades.length });
    } catch (error) {
        console.error('Error importing trades:', error);
        apiResponse.error(res, 'Failed to import trades');
    }
});

// GET all trades with pagination, filtering, and sorting
router.get('/', (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            ticker,
            accountId,
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

        if (accountId) {
            conditions.push('accountId = ?');
            params.push(Number(accountId));
        }

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
router.get('/:id', (req, res) => {
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
router.post('/', (req, res) => {
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
            notes,
            accountId
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
            const positionQuery = accountId
                ? `SELECT acquiredFromTradeId FROM positions
                   WHERE ticker = ? AND soldDate IS NULL AND acquiredFromTradeId IS NOT NULL AND accountId = ?
                   ORDER BY acquiredDate ASC LIMIT 1`
                : `SELECT acquiredFromTradeId FROM positions
                   WHERE ticker = ? AND soldDate IS NULL AND acquiredFromTradeId IS NOT NULL
                   ORDER BY acquiredDate ASC LIMIT 1`;
            const positionParams = accountId ? [tickerUpper, Number(accountId)] : [tickerUpper];
            const openPosition = db.prepare(positionQuery).get(...positionParams);

            if (openPosition && openPosition.acquiredFromTradeId) {
                resolvedParentTradeId = openPosition.acquiredFromTradeId;
                console.log(`🔗 Auto-linking CC to CSP trade #${resolvedParentTradeId} for ${tickerUpper}`);
            }
        }

        const stmt = db.prepare(`
      INSERT INTO trades (ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId, notes, accountId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            notes || null,
            accountId || null
        );

        const newTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);
        apiResponse.created(res, tradeToApi(newTrade));
    } catch (error) {
        console.error('Error creating trade:', error);
        apiResponse.error(res, 'Failed to create trade');
    }
});

// PUT update trade
router.put('/:id', (req, res) => {
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
                    INSERT INTO positions (ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, accountId)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(tickerUpper, shares, toCents(adjustedCostBasis), assignmentDate, req.params.id, currentTrade.accountId);
                console.log(`📈 Position created: ${shares} shares of ${tickerUpper} at $${adjustedCostBasis.toFixed(2)} (strike $${strike} - premium $${entryPrice})`);
            } else if (type === 'CC') {
                // CC Assigned: Close oldest open position (FIFO), scoped to same account
                const ccPositionQuery = currentTrade.accountId
                    ? 'SELECT * FROM positions WHERE ticker = ? AND soldDate IS NULL AND accountId = ? ORDER BY acquiredDate ASC LIMIT 1'
                    : 'SELECT * FROM positions WHERE ticker = ? AND soldDate IS NULL ORDER BY acquiredDate ASC LIMIT 1';
                const ccPositionParams = currentTrade.accountId ? [tickerUpper, currentTrade.accountId] : [tickerUpper];
                const openPosition = db.prepare(ccPositionQuery).get(...ccPositionParams);

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
router.delete('/:id', (req, res) => {
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

export default router;
