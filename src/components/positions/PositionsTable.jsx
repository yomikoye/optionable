import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, X } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || '';

export const PositionsTable = ({ onClose, showToast }) => {
    const [positions, setPositions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all'); // all, open, closed

    const fetchPositions = async () => {
        try {
            const [posRes, summaryRes] = await Promise.all([
                fetch(`${API_URL}/api/positions${filter !== 'all' ? `?status=${filter}` : ''}`),
                fetch(`${API_URL}/api/positions/summary`)
            ]);

            const posData = await posRes.json();
            const summaryData = await summaryRes.json();

            if (posData.success) setPositions(posData.data);
            if (summaryData.success) setSummary(summaryData.data);
        } catch (error) {
            console.error('Error fetching positions:', error);
            showToast?.('Failed to fetch positions', 'error');
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
                if (Object.values(data.data).some(p => !p.live)) {
                    showToast?.('Some prices from cache', 'warning');
                }
            }
        } catch (error) {
            console.error('Error fetching prices:', error);
            showToast?.('Failed to fetch live prices', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, [filter]);

    useEffect(() => {
        if (positions.length > 0) {
            fetchPrices();
        }
    }, [positions.length]);

    const calculateUnrealizedGL = (position) => {
        const price = prices[position.ticker]?.price;
        if (!price) return null;
        return (price - position.costBasis) * position.shares;
    };

    const totalUnrealizedGL = positions
        .filter(p => !p.soldDate)
        .reduce((sum, p) => {
            const gl = calculateUnrealizedGL(p);
            return sum + (gl || 0);
        }, 0);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-8">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-4 text-slate-600 dark:text-slate-400">Loading positions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Stock Positions</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Realized G/L</p>
                            <p className={`text-lg font-bold font-mono ${summary.realizedGainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(summary.realizedGainLoss)}
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Unrealized G/L</p>
                            <p className={`text-lg font-bold font-mono ${totalUnrealizedGL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(totalUnrealizedGL)}
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Open Positions</p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.openPositions}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Closed Positions</p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.closedPositions}</p>
                        </div>
                    </div>
                )}

                {/* Filter & Refresh */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                        {['all', 'open', 'closed'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    filter === f
                                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchPrices}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh Prices
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {positions.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No positions yet</p>
                            <p className="text-sm mt-1">Positions are created when CSP trades are assigned</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Ticker</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Shares</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Cost Basis</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Current</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">G/L</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {positions.map(position => {
                                    const currentPrice = position.soldDate ? position.salePrice : prices[position.ticker]?.price;
                                    const gainLoss = position.soldDate
                                        ? position.capitalGainLoss
                                        : (currentPrice ? (currentPrice - position.costBasis) * position.shares : null);

                                    return (
                                        <tr key={position.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3">
                                                <span className="font-semibold text-slate-900 dark:text-white">{position.ticker}</span>
                                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                    {position.acquiredDate}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                                                {position.shares}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
                                                ${position.costBasis.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-sm">
                                                {currentPrice ? (
                                                    <span className="text-slate-700 dark:text-slate-300">${currentPrice.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-slate-400">--</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {gainLoss !== null ? (
                                                    <span className={`font-mono text-sm font-medium flex items-center justify-end gap-1 ${gainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {gainLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                        {formatCurrency(gainLoss)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">--</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
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
                    )}
                </div>
            </div>
        </div>
    );
};
