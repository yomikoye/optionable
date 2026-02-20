import { useCallback } from 'react';
import { API_URL } from '../utils/constants';

const TRADE_HEADERS = ['id', 'ticker', 'type', 'strike', 'quantity', 'delta', 'entryPrice', 'closePrice', 'openedDate', 'expirationDate', 'closedDate', 'status', 'parentTradeId', 'notes', 'accountId'];
const FUND_HEADERS = ['type', 'amount', 'date', 'description', 'accountId'];
const STOCK_HEADERS = ['ticker', 'shares', 'costBasis', 'acquiredDate', 'soldDate', 'salePrice', 'notes', 'accountId'];

const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const rowToCSV = (obj, headers) =>
    headers.map(h => escapeCSV(obj[h])).join(',');

export const useCSV = ({ trades, fundTransactions, stocks, refreshAll, refreshPortfolio, showToast, setError, accountId }) => {
    const exportToCSV = useCallback(() => {
        const hasTrades = trades.length > 0;
        const hasFund = fundTransactions && fundTransactions.length > 0;
        const hasStocks = stocks && stocks.length > 0;

        if (!hasTrades && !hasFund && !hasStocks) {
            setError('No data to export');
            return;
        }

        const lines = [];

        // Trades section
        if (hasTrades) {
            lines.push('[TRADES]');
            lines.push(TRADE_HEADERS.join(','));
            for (const trade of trades) {
                lines.push(rowToCSV(trade, TRADE_HEADERS));
            }
        }

        // Fund transactions section
        if (hasFund) {
            if (lines.length > 0) lines.push('');
            lines.push('[FUND_TRANSACTIONS]');
            lines.push(FUND_HEADERS.join(','));
            for (const txn of fundTransactions) {
                lines.push(rowToCSV(txn, FUND_HEADERS));
            }
        }

        // Stocks section
        if (hasStocks) {
            if (lines.length > 0) lines.push('');
            lines.push('[STOCKS]');
            lines.push(STOCK_HEADERS.join(','));
            for (const stock of stocks) {
                lines.push(rowToCSV(stock, STOCK_HEADERS));
            }
        }

        const csvContent = lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `optionable_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [trades, fundTransactions, stocks, setError]);

    const importFromCSV = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const lines = text.split('\n').map(l => l.trimEnd());

            // Parse sections from file
            const sections = parseSections(lines);

            let importedCount = 0;
            const results = [];

            // Import trades
            if (sections.trades.length > 0) {
                const response = await fetch(`${API_URL}/trades/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trades: sections.trades, accountId: accountId || null }),
                });
                if (!response.ok) throw new Error('Failed to import trades');
                const result = await response.json();
                importedCount += result.data.imported;
                const tradeParts = [`${result.data.imported} trades`];
                if (result.data.skipped > 0) tradeParts.push(`${result.data.skipped} skipped`);
                results.push(tradeParts.join(', '));
            }

            // Import fund transactions (with dedup)
            if (sections.fundTransactions.length > 0) {
                // Fetch existing fund transactions for dedup
                const existingFundRes = await fetch(`${API_URL}/fund-transactions${accountId ? `?accountId=${accountId}` : ''}`);
                const existingFundData = existingFundRes.ok ? await existingFundRes.json() : { data: [] };
                const existingFundSet = new Set((existingFundData.data || []).map(f =>
                    `${f.type}|${f.amount}|${f.date}|${f.description || ''}`
                ));

                let fundCount = 0;
                let fundSkipped = 0;
                for (const txn of sections.fundTransactions) {
                    const key = `${txn.type}|${txn.amount}|${txn.date}|${txn.description || ''}`;
                    if (existingFundSet.has(key)) { fundSkipped++; continue; }
                    existingFundSet.add(key);
                    const response = await fetch(`${API_URL}/fund-transactions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...txn,
                            accountId: txn.accountId || accountId || null,
                        }),
                    });
                    if (response.ok) fundCount++;
                }
                importedCount += fundCount;
                const fundParts = [`${fundCount} fund transactions`];
                if (fundSkipped > 0) fundParts.push(`${fundSkipped} skipped`);
                results.push(fundParts.join(', '));
            }

            // Import stocks (with dedup)
            if (sections.stocks.length > 0) {
                // Fetch existing stocks for dedup
                const existingStockRes = await fetch(`${API_URL}/stocks${accountId ? `?accountId=${accountId}` : ''}`);
                const existingStockData = existingStockRes.ok ? await existingStockRes.json() : { data: [] };
                const existingStockSet = new Set((existingStockData.data || []).map(s =>
                    `${s.ticker}|${s.shares}|${s.costBasis}|${s.acquiredDate}`
                ));

                let stockCount = 0;
                let stockSkipped = 0;
                for (const stock of sections.stocks) {
                    const key = `${stock.ticker}|${stock.shares}|${stock.costBasis}|${stock.acquiredDate}`;
                    if (existingStockSet.has(key)) { stockSkipped++; continue; }
                    existingStockSet.add(key);
                    const body = {
                        ticker: stock.ticker,
                        shares: Number(stock.shares),
                        costBasis: Number(stock.costBasis),
                        acquiredDate: stock.acquiredDate,
                        notes: stock.notes || null,
                        accountId: stock.accountId || accountId || null,
                    };
                    const response = await fetch(`${API_URL}/stocks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    if (response.ok) {
                        stockCount++;
                        // If stock was sold, update with sale info
                        if (stock.soldDate) {
                            const created = await response.json();
                            await fetch(`${API_URL}/stocks/${created.data.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    soldDate: stock.soldDate,
                                    salePrice: Number(stock.salePrice),
                                }),
                            });
                        }
                    }
                }
                importedCount += stockCount;
                const stockParts = [`${stockCount} stocks`];
                if (stockSkipped > 0) stockParts.push(`${stockSkipped} skipped`);
                results.push(stockParts.join(', '));
            }

            await refreshAll();
            if (refreshPortfolio) await refreshPortfolio();
            showToast(`Imported ${results.join(', ')}`);
        } catch (err) {
            console.error('Error importing CSV:', err);
            setError('Failed to import CSV. Please check the file format.');
        }

        event.target.value = '';
    }, [refreshAll, refreshPortfolio, showToast, setError, accountId]);

    return { exportToCSV, importFromCSV };
};

/**
 * Parse a CSV file with optional section markers [TRADES], [FUND_TRANSACTIONS], [STOCKS].
 * Falls back to treating the entire file as trades (backward-compatible).
 */
function parseSections(lines) {
    const sections = { trades: [], fundTransactions: [], stocks: [] };

    // Check if file uses section markers
    const hasMarkers = lines.some(l => /^\[(TRADES|FUND_TRANSACTIONS|STOCKS)\]$/.test(l.trim()));

    if (!hasMarkers) {
        // Legacy format: entire file is trades
        sections.trades = parseCSVBlock(lines);
        return sections;
    }

    // Split into sections by markers
    let currentSection = null;
    let currentLines = [];

    const flushSection = () => {
        if (currentSection && currentLines.length > 0) {
            const parsed = parseCSVBlock(currentLines);
            if (currentSection === 'TRADES') sections.trades = parsed;
            else if (currentSection === 'FUND_TRANSACTIONS') sections.fundTransactions = parsed;
            else if (currentSection === 'STOCKS') sections.stocks = parsed;
        }
        currentLines = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const marker = trimmed.match(/^\[(TRADES|FUND_TRANSACTIONS|STOCKS)\]$/);
        if (marker) {
            flushSection();
            currentSection = marker[1];
        } else if (trimmed !== '') {
            currentLines.push(line);
        }
    }
    flushSection();

    return sections;
}

/**
 * Parse a block of CSV lines (header + data rows) into an array of objects.
 */
function parseCSVBlock(lines) {
    const nonEmpty = lines.filter(l => l.trim() !== '');
    if (nonEmpty.length < 2) return [];

    const headers = parseCSVRow(nonEmpty[0]);
    const rows = [];
    for (let i = 1; i < nonEmpty.length; i++) {
        const values = parseCSVRow(nonEmpty[i]);
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            const val = values[j] || '';
            obj[headers[j].trim()] = val;
        }
        rows.push(obj);
    }
    return rows;
}

/**
 * Parse a single CSV row, handling quoted fields.
 */
function parseCSVRow(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current);
    return fields;
}
