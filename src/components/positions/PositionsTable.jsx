import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || '';

export const PositionsTable = ({ showToast, accountId }) => {
    const [positions, setPositions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('open');

    const fetchPositions = async () => {
        try {
            const acctParam = accountId ? `accountId=${accountId}&` : '';
            const statusParam = filter !== 'all' ? `status=${filter}` : '';
            const query = [acctParam, statusParam].filter(Boolean).join('&');
            const [posRes, summaryRes] = await Promise.all([
                fetch(`${API_URL}/api/positions${query ? `?${query}` : ''}`),
                fetch(`${API_URL}/api/positions/summary${accountId ? `?accountId=${accountId}` : ''}`)
            ]);

            const posData = await posRes.json();
            const summaryData = await summaryRes.json();

            if (posData.success) setPositions(posData.data);
            if (summaryData.success) setSummary(summaryData.data);
        } catch (error) {
            console.error('Error fetching positions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPrices = async () => {
        const openPositions = positions.filter(p => !p.soldDate);
        if (openPositions.length === 0) return;

        setRefreshing(true);
        try {
            const tickers = [...new Set(openPositions.map(p => p.ticker))];
            const res = await fetch(`${API_URL}/api/prices/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers })
            });
            const data = await res.json();
            if (data.success) {
                setPrices(data.data);
            }
        } catch (error) {
            console.error('Error fetching prices:', error);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, [filter, accountId]);

    useEffect(() => {
        if (positions.length > 0) {
            fetchPrices();
        }
    }, [positions.length]);

    const totalUnrealizedGL = positions
        .filter(p => !p.soldDate)
        .reduce((sum, p) => {
            const price = prices[p.ticker]?.price;
            if (!price) return sum;
            return sum + (price - p.costBasis) * p.shares;
        }, 0);

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-8">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Stock Positions</h3>
                    {summary && (
                        <div className="flex items-center gap-3 ml-3 text-sm">
                            <span className="text-slate-500 dark:text-slate-400">
                                {summary.openPositions} open
                            </span>
                            {summary.realizedGainLoss !== 0 && (
                                <span className={`font-mono ${summary.realizedGainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Realized: {formatCurrency(summary.realizedGainLoss)}
                                </span>
                            )}
                            {totalUnrealizedGL !== 0 && (
                                <span className={`font-mono ${totalUnrealizedGL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Unrealized: {formatCurrency(totalUnrealizedGL)}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        {['open', 'closed', 'all'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-2 py-0.5 text-xs rounded font-medium transition-colors capitalize ${
                                    filter === f
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchPrices}
                        disabled={refreshing}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors text-slate-600 dark:text-slate-400"
                    >
                        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                        Prices
                    </button>
                </div>
            </div>

            {/* Table */}
            {positions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No {filter !== 'all' ? filter : ''} positions. Positions are created when CSP trades are assigned.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left p-3 text-slate-500 dark:text-slate-400 font-medium">Ticker</th>
                                <th className="text-right p-3 text-slate-500 dark:text-slate-400 font-medium">Shares</th>
                                <th className="text-right p-3 text-slate-500 dark:text-slate-400 font-medium">Cost Basis</th>
                                <th className="text-right p-3 text-slate-500 dark:text-slate-400 font-medium">Current</th>
                                <th className="text-right p-3 text-slate-500 dark:text-slate-400 font-medium">P/L</th>
                                <th className="text-center p-3 text-slate-500 dark:text-slate-400 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map(position => {
                                const currentPrice = position.soldDate ? position.salePrice : prices[position.ticker]?.price;
                                const gainLoss = position.soldDate
                                    ? position.capitalGainLoss
                                    : (currentPrice ? (currentPrice - position.costBasis) * position.shares : null);

                                return (
                                    <tr key={position.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="p-3">
                                            <span className="font-medium text-slate-900 dark:text-white">{position.ticker}</span>
                                            <span className="block text-xs text-slate-400">{position.acquiredDate}</span>
                                        </td>
                                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                            {position.shares}
                                        </td>
                                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                            ${position.costBasis.toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right font-mono">
                                            {currentPrice ? (
                                                <span className="text-slate-700 dark:text-slate-300">${currentPrice.toFixed(2)}</span>
                                            ) : (
                                                <span className="text-slate-400">--</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            {gainLoss !== null ? (
                                                <span className={`font-mono font-medium flex items-center justify-end gap-1 ${gainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {gainLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {formatCurrency(gainLoss)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">--</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                                position.soldDate
                                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                            }`}>
                                                {position.soldDate ? 'Closed' : 'Open'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
