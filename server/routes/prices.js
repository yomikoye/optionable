import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCents, toDollars } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';

const router = Router();

// GET stock price (with caching)
router.get('/:ticker', async (req, res) => {
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

// POST multiple stock prices
router.post('/batch', async (req, res) => {
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

export default router;
