import { useCallback } from 'react';
import Papa from 'papaparse';
import { API_URL } from '../utils/constants';

export const useCSV = ({ trades, refreshAll, showToast, setError }) => {
    const exportToCSV = useCallback(() => {
        if (trades.length === 0) {
            setError('No trades to export');
            return;
        }

        const headers = ['id', 'ticker', 'type', 'strike', 'quantity', 'delta', 'entryPrice', 'closePrice', 'openedDate', 'expirationDate', 'closedDate', 'status', 'parentTradeId', 'notes'];

        const csvContent = [
            headers.join(','),
            ...trades.map(trade =>
                headers.map(header => {
                    const value = trade[header];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
                    return value;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `optionable_trades_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [trades, setError]);

    const importFromCSV = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();

            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h) => h.trim(),
            });

            if (parsed.data.length === 0) {
                setError('CSV file is empty or invalid');
                event.target.value = '';
                return;
            }

            const headers = parsed.meta.fields;
            const requiredHeaders = ['ticker', 'type', 'strike', 'entryPrice', 'openedDate', 'expirationDate', 'status'];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

            if (missingHeaders.length > 0) {
                setError(`Missing required columns: ${missingHeaders.join(', ')}`);
                event.target.value = '';
                return;
            }

            const tradesToImport = parsed.data.map(trade => ({
                id: trade.id ? Number(trade.id) : null,
                ticker: trade.ticker,
                type: trade.type,
                strike: Number(trade.strike) || 0,
                quantity: Number(trade.quantity) || 1,
                delta: trade.delta ? Number(trade.delta) : null,
                entryPrice: Number(trade.entryPrice) || 0,
                closePrice: Number(trade.closePrice) || 0,
                openedDate: trade.openedDate,
                expirationDate: trade.expirationDate,
                closedDate: trade.closedDate || null,
                status: trade.status || 'Open',
                parentTradeId: trade.parentTradeId ? Number(trade.parentTradeId) : null,
                notes: trade.notes || null,
            }));

            // Import trades via API
            const response = await fetch(`${API_URL}/trades/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trades: tradesToImport }),
            });

            if (!response.ok) throw new Error('Failed to import trades');

            const result = await response.json();
            await refreshAll();
            showToast(`Successfully imported ${result.data.imported} trades!`);
        } catch (err) {
            console.error('Error importing CSV:', err);
            setError('Failed to import CSV. Please check the file format.');
        }

        // Reset file input
        event.target.value = '';
    }, [refreshAll, showToast, setError]);

    return { exportToCSV, importFromCSV };
};
