import { useState, useMemo } from 'react';
import { calculateMetrics, calculateDaysHeld } from '../utils/calculations';

export const useFilterSort = (trades) => {
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);

    const filteredAndSortedTrades = useMemo(() => {
        // Filter by status
        let result = trades;
        if (statusFilter === 'open') {
            result = trades.filter(t => t.status === 'Open');
        } else if (statusFilter === 'closed') {
            result = trades.filter(t => t.status !== 'Open');
        }

        // Sort if sort config is set
        if (sortConfig.key) {
            // Pre-compute metrics/values once before sorting (avoid O(n log n) recalculations)
            const needsMetrics = ['pnl', 'roi', 'annualizedRoi'].includes(sortConfig.key);
            const needsDaysHeld = sortConfig.key === 'daysHeld';

            let sortCache;
            if (needsMetrics || needsDaysHeld) {
                sortCache = new Map();
                for (const trade of result) {
                    if (needsMetrics) {
                        sortCache.set(trade.id, calculateMetrics(trade)[sortConfig.key]);
                    } else {
                        sortCache.set(trade.id, calculateDaysHeld(trade));
                    }
                }
            }

            result = [...result].sort((a, b) => {
                let aVal, bVal;

                if (sortCache) {
                    aVal = sortCache.get(a.id);
                    bVal = sortCache.get(b.id);
                } else if (sortConfig.key === 'ticker') {
                    aVal = a.ticker.toLowerCase();
                    bVal = b.ticker.toLowerCase();
                } else if (sortConfig.key === 'openedDate' || sortConfig.key === 'expirationDate') {
                    aVal = new Date(a[sortConfig.key]);
                    bVal = new Date(b[sortConfig.key]);
                } else {
                    aVal = a[sortConfig.key];
                    bVal = b[sortConfig.key];
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [trades, statusFilter, sortConfig]);

    return {
        statusFilter,
        setStatusFilter,
        sortConfig,
        setSortConfig,
        currentPage,
        setCurrentPage,
        filteredAndSortedTrades
    };
};
