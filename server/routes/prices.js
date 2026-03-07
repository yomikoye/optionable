import { Router } from 'express';
import { db } from '../db/connection.js';
import { toCents, toDollars } from '../utils/conversions.js';
import { apiResponse } from '../utils/response.js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const router = Router();

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

const isCacheFresh = (updatedAt) => {
    if (!updatedAt) return false;
    return (Date.now() - new Date(updatedAt + 'Z').getTime()) < CACHE_TTL_MS;
};

// In-memory cache for option prices (no DB table)
const optionPriceCache = new Map(); // key -> { data, fetchedAt }
const MAX_OPTION_CACHE_ENTRIES = 100;

const evictStaleOptionCache = () => {
    if (optionPriceCache.size <= MAX_OPTION_CACHE_ENTRIES) return;
    const now = Date.now();
    for (const [key, val] of optionPriceCache) {
        if (now - val.fetchedAt >= CACHE_TTL_MS) optionPriceCache.delete(key);
    }
    // If still over limit, remove oldest entries
    if (optionPriceCache.size > MAX_OPTION_CACHE_ENTRIES) {
        const sorted = [...optionPriceCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
        const toRemove = sorted.length - MAX_OPTION_CACHE_ENTRIES;
        for (let i = 0; i < toRemove; i++) optionPriceCache.delete(sorted[i][0]);
    }
};

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

        // Return fresh cache if available
        const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(ticker);
        if (cached && isCacheFresh(cached.updatedAt)) {
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

        // Cache stale or missing — fetch from Yahoo Finance
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

        // Fallback to stale cache
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

        // Check cache first, only fetch stale tickers from Yahoo
        const results = {};
        const staleTickers = [];

        for (const t of uniqueTickers) {
            const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(t);
            if (cached && isCacheFresh(cached.updatedAt)) {
                results[t] = {
                    ticker: cached.ticker,
                    price: toDollars(cached.price),
                    change: toDollars(cached.change),
                    changePercent: cached.changePercent,
                    name: cached.name,
                    live: false,
                    cachedAt: cached.updatedAt
                };
            } else {
                staleTickers.push(t);
            }
        }

        // Fetch stale tickers from Yahoo Finance
        const fetchPrice = async (ticker) => {
            try {
                const quote = await yahooFinance.quote(ticker);

                if (quote && quote.regularMarketPrice != null) {
                    const price = quote.regularMarketPrice;
                    const change = quote.regularMarketChange ?? 0;
                    const changePercent = quote.regularMarketChangePercent ?? 0;
                    const name = quote.shortName || quote.longName || '';

                    db.prepare(`
                        INSERT OR REPLACE INTO price_cache (ticker, price, change, changePercent, name, updatedAt)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(ticker, toCents(price), toCents(change), changePercent, name);

                    return { ticker, data: { price, change, changePercent, name, live: true } };
                }
            } catch (e) {
                // Fall through to cache
            }

            const cached = db.prepare('SELECT * FROM price_cache WHERE ticker = ?').get(ticker);
            if (cached) {
                return {
                    ticker,
                    data: {
                        ticker: cached.ticker,
                        price: toDollars(cached.price),
                        change: toDollars(cached.change),
                        changePercent: cached.changePercent,
                        name: cached.name,
                        live: false
                    }
                };
            }
            return { ticker, data: null };
        };

        const priceResults = await Promise.all(staleTickers.map(fetchPrice));

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
            if (!c.ticker || !c.expirationDate || c.strike == null || !c.type) continue;
            const ticker = String(c.ticker).toUpperCase();
            const type = String(c.type).toUpperCase();
            if (!['CSP', 'CC', 'CALL', 'PUT'].includes(type)) continue;
            const key = `${ticker}:${c.expirationDate}`;
            if (!groups[key]) {
                groups[key] = { ticker, expirationDate: c.expirationDate, lookups: [] };
            }
            groups[key].lookups.push({ strike: Number(c.strike), type });
        }

        const results = {};
        const staleGroups = [];

        // Check in-memory cache for each group
        for (const [groupKey, group] of Object.entries(groups)) {
            const cached = optionPriceCache.get(groupKey);
            if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
                // Serve from cache — match requested contracts
                for (const { strike, type } of group.lookups) {
                    const contractKey = `${group.ticker}:${strike}:${group.expirationDate}:${type}`;
                    if (cached.data[contractKey]) {
                        results[contractKey] = cached.data[contractKey];
                    }
                }
            } else {
                staleGroups.push(group);
            }
        }

        // Fetch stale groups from Yahoo Finance
        const fetchGroup = async ({ ticker, expirationDate, lookups }) => {
            const groupKey = `${ticker}:${expirationDate}`;
            const groupData = {};
            try {
                const opts = await yahooFinance.options(ticker, { date: new Date(expirationDate) });
                const chain = opts.options?.[0];
                if (!chain) return;

                // Cache the full chain for this ticker+expiry
                const allContracts = [...(chain.calls || []), ...(chain.puts || [])];
                for (const c of allContracts) {
                    const isCall = chain.calls?.includes(c);
                    for (const t of ['CSP', 'CC', 'CALL', 'PUT']) {
                        const matchesSide = (t === 'CALL' || t === 'CC') ? isCall : !isCall;
                        if (matchesSide) {
                            const mid = c.bid != null && c.ask != null && c.bid > 0 && c.ask > 0
                                ? (c.bid + c.ask) / 2 : c.lastPrice;
                            groupData[`${ticker}:${c.strike}:${expirationDate}:${t}`] = {
                                price: round2(mid ?? c.lastPrice ?? 0),
                                bid: round2(c.bid ?? 0),
                                ask: round2(c.ask ?? 0),
                                lastPrice: round2(c.lastPrice ?? 0),
                                iv: c.impliedVolatility ?? null,
                                live: true
                            };
                        }
                    }
                }

                optionPriceCache.set(groupKey, { data: groupData, fetchedAt: Date.now() });
                evictStaleOptionCache();

                // Return only the requested contracts
                for (const { strike, type } of lookups) {
                    const key = `${ticker}:${strike}:${expirationDate}:${type}`;
                    if (groupData[key]) {
                        results[key] = groupData[key];
                    }
                }
            } catch (e) {
                console.error(`Error fetching options for ${ticker} ${expirationDate}:`, e.message);
            }
        };

        await Promise.all(staleGroups.map(fetchGroup));

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
