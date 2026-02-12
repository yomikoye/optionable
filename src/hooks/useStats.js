import { useState, useMemo, useCallback, useEffect } from 'react';
import { API_URL } from '../utils/constants';
import { calculateMetrics } from '../utils/calculations';

export const useStats = (trades) => {
    const [capitalGainsStats, setCapitalGainsStats] = useState({
        realizedCapitalGL: 0,
        openPositions: 0,
        closedPositions: 0
    });
    const [chartPeriod, setChartPeriod] = useState('all');

    const fetchCapitalGainsStats = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/stats`);
            if (!response.ok) return;
            const json = await response.json();
            setCapitalGainsStats({
                realizedCapitalGL: json.data.realizedCapitalGL || 0,
                openPositions: json.data.openPositions || 0,
                closedPositions: json.data.closedPositions || 0
            });
        } catch (err) {
            console.error('Error fetching capital gains stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchCapitalGainsStats();
    }, [fetchCapitalGainsStats]);

    const stats = useMemo(() => {
        // Filter trades by time period (same as chart)
        const now = new Date();
        const periodStart = {
            '1m': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
            '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
            '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[chartPeriod];

        const filteredTrades = trades.filter(t => {
            const tradeDate = new Date(t.closedDate || t.expirationDate || t.openedDate);
            return tradeDate >= periodStart;
        });

        // Completed trades = not Open and not Rolled (terminal states only)
        const completedTrades = filteredTrades.filter(t => t.status !== 'Open' && t.status !== 'Rolled');
        const openTrades = filteredTrades.filter(t => t.status === 'Open');

        // P/L for all non-open trades (includes Rolled for accurate total)
        const allClosedTrades = filteredTrades.filter(t => t.status !== 'Open');
        const totalPnL = allClosedTrades.reduce((acc, t) => acc + calculateMetrics(t).pnl, 0);

        // Ticker stats (all closed trades)
        const tickerStats = {};
        allClosedTrades.forEach(t => {
            const { pnl } = calculateMetrics(t);
            const ticker = t.ticker.toUpperCase();
            if (!tickerStats[ticker]) tickerStats[ticker] = 0;
            tickerStats[ticker] += pnl;
        });

        // Monthly stats (all closed trades)
        const monthlyStats = {};
        allClosedTrades.forEach(t => {
            const { pnl } = calculateMetrics(t);
            const date = new Date(t.openedDate);
            const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = 0;
            monthlyStats[monthKey] += pnl;
        });

        // Chain-based win rate calculation
        const chainRoots = filteredTrades.filter(t => !t.parentTradeId);

        const chains = chainRoots.map(root => {
            let chainPnL = calculateMetrics(root).pnl;
            let finalStatus = root.status;
            let currentId = root.id;

            let child = filteredTrades.find(t => t.parentTradeId === currentId);
            while (child) {
                chainPnL += calculateMetrics(child).pnl;
                finalStatus = child.status;
                currentId = child.id;
                child = filteredTrades.find(t => t.parentTradeId === currentId);
            }

            return {
                rootId: root.id,
                chainPnL,
                finalStatus,
                isResolved: finalStatus !== 'Open' && finalStatus !== 'Rolled'
            };
        });

        const resolvedChains = chains.filter(c => c.isResolved);
        const winningChains = resolvedChains.filter(c => c.chainPnL > 0).length;
        const winRate = resolvedChains.length > 0 ? (winningChains / resolvedChains.length) * 100 : 0;

        const avgRoi = completedTrades.length > 0
            ? completedTrades.reduce((acc, t) => acc + calculateMetrics(t).roi, 0) / completedTrades.length
            : 0;

        const capitalAtRisk = openTrades
            .filter(t => t.type === 'CSP')
            .reduce((acc, t) => acc + calculateMetrics(t).collateral, 0);

        const rolledCount = filteredTrades.filter(t => t.status === 'Rolled').length;

        const totalPremiumCollected = allClosedTrades.reduce((acc, t) => {
            const { pnl } = calculateMetrics(t);
            return acc + pnl;
        }, 0);

        const bestTicker = Object.entries(tickerStats).length > 0
            ? Object.entries(tickerStats).reduce((best, [ticker, pnl]) =>
                pnl > (best?.pnl || -Infinity) ? { ticker, pnl } : best, null)
            : null;

        return {
            totalPnL,
            tickerStats,
            monthlyStats,
            winRate,
            avgRoi,
            capitalAtRisk,
            openTradesCount: openTrades.length,
            completedTradesCount: completedTrades.length,
            closedTradesCount: allClosedTrades.length,
            resolvedChains: resolvedChains.length,
            rolledCount,
            totalPremiumCollected,
            bestTicker,
            realizedCapitalGL: capitalGainsStats.realizedCapitalGL,
            openPositions: capitalGainsStats.openPositions,
            closedPositions: capitalGainsStats.closedPositions,
            totalPnLWithCapitalGains: totalPnL + capitalGainsStats.realizedCapitalGL
        };
    }, [trades, capitalGainsStats, chartPeriod]);

    // Build a map of trade chains for visual indicators
    const chainInfo = useMemo(() => {
        const parentToChild = new Map();
        const childToParent = new Map();

        trades.forEach(t => {
            if (t.parentTradeId) {
                parentToChild.set(t.parentTradeId, t.id);
                childToParent.set(t.id, t.parentTradeId);
            }
        });

        return { parentToChild, childToParent };
    }, [trades]);

    // Chart data (only completed trades)
    const chartData = useMemo(() => {
        let completedTrades = trades.filter(t => t.status !== 'Open');
        if (completedTrades.length === 0) return [];

        const now = new Date();
        const periodStart = {
            '1m': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
            '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
            '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
            'ytd': new Date(now.getFullYear(), 0, 1),
            'all': new Date(0)
        }[chartPeriod];

        completedTrades = completedTrades.filter(t => {
            const tradeDate = new Date(t.closedDate || t.expirationDate || t.openedDate);
            return tradeDate >= periodStart;
        });

        const sortedTrades = [...completedTrades].sort((a, b) => {
            const dateA = a.closedDate || a.expirationDate || a.openedDate;
            const dateB = b.closedDate || b.expirationDate || b.openedDate;
            return new Date(dateA) - new Date(dateB);
        });

        let cumulativePnL = 0;
        return sortedTrades.map(trade => {
            const { pnl } = calculateMetrics(trade);
            cumulativePnL += pnl;
            const chartDate = trade.closedDate || trade.expirationDate || trade.openedDate;
            return {
                date: new Date(chartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                fullDate: chartDate,
                pnl: cumulativePnL,
                tradePnl: pnl,
                ticker: trade.ticker.toUpperCase()
            };
        });
    }, [trades, chartPeriod]);

    return {
        stats,
        chainInfo,
        chartData,
        chartPeriod,
        setChartPeriod,
        fetchCapitalGainsStats
    };
};
