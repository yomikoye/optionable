import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCents, toDollars } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const router = Router();

// GET stock price (with caching)
router.get('/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase();

        // Check settings
        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('live_prices_enabled');
        if (!setting || setting.value !== 'true') {
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

        // Try to fetch from Yahoo Finance
        try {
            const quote = await yahooFinance.quote(ticker);

            if (quote && quote.regularMarketPrice != null) {
                const price = quote.regularMarketPrice;
                const change = quote.regularMarketChange ?? 0;
                const changePercent = quote.regularMarketChangePercent ?? 0;
                const name = quote.shortName || quote.longName || '';

                // Update cache (store as cents)
                db.prepare(`
                    INSERT OR REPLACE INTO price_cache (ticker, price, change, changePercent, name, updatedAt)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(ticker, toCents(price), toCents(change), changePercent, name);

                return apiResponse.success(res, {
                    ticker,
                    price,
                    change,
                    changePercent,
                    name,
                    source: 'live',
                    live: true
                });
            }
        } catch (fetchError) {
            console.error('Error fetching live price:', fetchError.message);
        }

        // Fallback to cache
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

        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('live_prices_enabled');
        const livePricesEnabled = setting && setting.value === 'true';

        const uniqueTickers = [...new Set(tickers.slice(0, 20).map(t => t.toUpperCase()))];

        // If live prices disabled, return cached prices only
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

        // Fetch all prices concurrently from Yahoo Finance
        const fetchPrice = async (ticker) => {
            try {
                const quote = await yahooFinance.quote(ticker);

                if (quote && quote.regularMarketPrice != null) {
                    const price = quote.regularMarketPrice;
                    const change = quote.regularMarketChange ?? 0;
                    const changePercent = quote.regularMarketChangePercent ?? 0;
                    const name = quote.shortName || quote.longName || '';

                    // Update cache
                    db.prepare(`
                        INSERT OR REPLACE INTO price_cache (ticker, price, change, changePercent, name, updatedAt)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(ticker, toCents(price), toCents(change), changePercent, name);

                    return {
                        ticker,
                        data: { price, change, changePercent, name, live: true }
                    };
                }
            } catch (e) {
                // Fall through to cache
            }

            // Fallback to cache
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

// POST option contract prices
// Accepts: { contracts: [{ ticker, strike, expirationDate, type }] }
// Returns: { "ONDS:10:2027-01-15:CALL": { price, bid, ask } }
router.post('/options/batch', async (req, res) => {
    try {
        const { contracts } = req.body;
        if (!Array.isArray(contracts) || contracts.length === 0) {
            return apiResponse.error(res, 'No contracts provided', 400);
        }

        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('live_prices_enabled');
        if (!setting || setting.value !== 'true') {
            return apiResponse.success(res, {});
        }

        // Group contracts by ticker+expiry to minimize API calls
        const groups = {};
        for (const c of contracts.slice(0, 20)) {
            const key = `${c.ticker.toUpperCase()}:${c.expirationDate}`;
            if (!groups[key]) {
                groups[key] = { ticker: c.ticker.toUpperCase(), expirationDate: c.expirationDate, lookups: [] };
            }
            groups[key].lookups.push({ strike: Number(c.strike), type: c.type });
        }

        const results = {};

        const fetchGroup = async ({ ticker, expirationDate, lookups }) => {
            try {
                const opts = await yahooFinance.options(ticker, { date: new Date(expirationDate) });
                const chain = opts.options?.[0];
                if (!chain) return;

                for (const { strike, type } of lookups) {
                    const isCall = type === 'CALL' || type === 'CC';
                    const contracts = isCall ? chain.calls : chain.puts;
                    const match = contracts?.find(c => c.strike === strike);
                    if (match) {
                        const key = `${ticker}:${strike}:${expirationDate}:${type}`;
                        const mid = match.bid != null && match.ask != null && match.bid > 0 && match.ask > 0
                            ? (match.bid + match.ask) / 2
                            : match.lastPrice;
                        results[key] = {
                            price: round2(mid ?? match.lastPrice ?? 0),
                            bid: round2(match.bid ?? 0),
                            ask: round2(match.ask ?? 0),
                            lastPrice: round2(match.lastPrice ?? 0),
                            iv: match.impliedVolatility ?? null,
                            live: true
                        };
                    }
                }
            } catch (e) {
                console.error(`Error fetching options for ${ticker} ${expirationDate}:`, e.message);
            }
        };

        await Promise.all(Object.values(groups).map(fetchGroup));

        apiResponse.success(res, results);
    } catch (error) {
        console.error('Error fetching option prices:', error);
        apiResponse.error(res, 'Failed to fetch option prices');
    }
});

function round2(n) {
    return Math.round(n * 100) / 100;
}

export default router;
