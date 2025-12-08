import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Trash2,
    Edit2,
    Activity,
    Calendar,
    X,
    TrendingUp,
    Copy,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

// --- API Base URL ---
const API_URL = '/api';

// --- Constants ---
const TRADES_PER_PAGE = 10;

// --- Helper Functions ---
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
};

const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const formatPercent = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 }).format(val / 100);
};

// Calculate Days to Expiration
const calculateDTE = (expirationDate, status) => {
    if (status !== 'Open') return null;
    if (!expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Calculate days held for a trade
const calculateDaysHeld = (trade) => {
    const openDate = new Date(trade.openedDate);
    const closeDate = trade.closedDate ? new Date(trade.closedDate) :
        (trade.status === 'Open' ? new Date() : new Date(trade.expirationDate));
    const diffTime = Math.abs(closeDate - openDate);
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

const calculateMetrics = (trade) => {
    const quantity = parseFloat(trade.quantity) || 0;
    const strike = parseFloat(trade.strike) || 0;
    const entryPrice = parseFloat(trade.entryPrice) || 0;
    const closePrice = parseFloat(trade.closePrice) || 0;

    const totalPremium = entryPrice * quantity * 100;
    const totalCloseCost = closePrice * quantity * 100;
    const pnl = totalPremium - totalCloseCost;

    const collateral = strike * quantity * 100;
    const roi = collateral > 0 ? (pnl / collateral) * 100 : 0;

    const daysHeld = calculateDaysHeld(trade);
    const annualizedRoi = daysHeld > 0 ? (roi / daysHeld) * 365 : 0;

    const maxProfitPercent = totalPremium > 0 ? ((totalPremium - totalCloseCost) / totalPremium) * 100 : 0;

    return { totalPremium, totalCloseCost, pnl, roi, collateral, maxProfitPercent, annualizedRoi, daysHeld };
};

// --- Main Component ---
export default function App() {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Form State
    const initialFormState = {
        ticker: '',
        openedDate: new Date().toISOString().split('T')[0],
        expirationDate: '',
        closedDate: '',
        strike: '',
        type: 'CSP',
        quantity: 1,
        entryPrice: '',
        closePrice: '',
        status: 'Open',
    };
    const [formData, setFormData] = useState(initialFormState);

    // --- Data Fetching ---
    const fetchTrades = async () => {
        try {
            const response = await fetch(`${API_URL}/trades`);
            if (!response.ok) throw new Error('Failed to fetch trades');
            const data = await response.json();
            setTrades(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching trades:', err);
            setError('Failed to load trades. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
    }, []);

    // --- Pagination ---
    const totalPages = Math.ceil(trades.length / TRADES_PER_PAGE);
    const paginatedTrades = useMemo(() => {
        const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
        return trades.slice(startIndex, startIndex + TRADES_PER_PAGE);
    }, [trades, currentPage]);

    // Reset to page 1 when trades change significantly
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // --- Handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const openModal = (trade = null) => {
        if (trade) {
            setEditingId(trade.id);
            setFormData({
                ticker: trade.ticker,
                openedDate: trade.openedDate,
                expirationDate: trade.expirationDate,
                closedDate: trade.closedDate || '',
                strike: trade.strike,
                type: trade.type,
                quantity: trade.quantity,
                entryPrice: trade.entryPrice,
                closePrice: trade.closePrice || '',
                status: trade.status,
            });
        } else {
            setEditingId(null);
            setFormData({
                ...initialFormState,
                openedDate: new Date().toISOString().split('T')[0]
            });
        }
        setIsModalOpen(true);
    };

    // Duplicate trade - opens modal with trade data but no editingId (creates new)
    const duplicateTrade = (trade) => {
        setEditingId(null); // Important: null means create new
        setFormData({
            ticker: trade.ticker,
            openedDate: new Date().toISOString().split('T')[0], // Today's date
            expirationDate: '', // Clear so user must enter new date
            closedDate: '',
            strike: trade.strike,
            type: trade.type,
            quantity: trade.quantity,
            entryPrice: '', // Clear so user enters new premium
            closePrice: '',
            status: 'Open',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFormData(initialFormState);
        setEditingId(null);
    };

    const saveTrade = async (e) => {
        e.preventDefault();

        const tradeData = {
            ticker: formData.ticker,
            type: formData.type,
            strike: Number(formData.strike),
            quantity: Number(formData.quantity),
            entryPrice: Number(formData.entryPrice),
            closePrice: formData.closePrice ? Number(formData.closePrice) : 0,
            openedDate: formData.openedDate,
            expirationDate: formData.expirationDate,
            closedDate: formData.closedDate || null,
            status: formData.status,
        };

        try {
            const url = editingId ? `${API_URL}/trades/${editingId}` : `${API_URL}/trades`;
            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tradeData),
            });

            if (!response.ok) throw new Error('Failed to save trade');

            await fetchTrades();
            closeModal();
            // Go to first page when adding new trade
            if (!editingId) setCurrentPage(1);
        } catch (err) {
            console.error('Error saving trade:', err);
            setError('Failed to save trade. Please try again.');
        }
    };

    const deleteTrade = async (id) => {
        if (!window.confirm('Are you sure you want to delete this trade?')) return;

        try {
            const response = await fetch(`${API_URL}/trades/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete trade');
            await fetchTrades();
        } catch (err) {
            console.error('Error deleting trade:', err);
            setError('Failed to delete trade. Please try again.');
        }
    };

    // --- Aggregation Logic ---
    const stats = useMemo(() => {
        // Completed trades = not Open (includes Expired, Assigned, Closed)
        const completedTrades = trades.filter(t => t.status !== 'Open');
        const openTrades = trades.filter(t => t.status === 'Open');

        // P/L only for completed trades
        const totalPnL = completedTrades.reduce((acc, t) => acc + calculateMetrics(t).pnl, 0);

        // Ticker stats (completed trades only)
        const tickerStats = {};
        completedTrades.forEach(t => {
            const { pnl } = calculateMetrics(t);
            const ticker = t.ticker.toUpperCase();
            if (!tickerStats[ticker]) tickerStats[ticker] = 0;
            tickerStats[ticker] += pnl;
        });

        // Monthly stats (completed trades only)
        const monthlyStats = {};
        completedTrades.forEach(t => {
            const { pnl } = calculateMetrics(t);
            const date = new Date(t.openedDate);
            const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = 0;
            monthlyStats[monthKey] += pnl;
        });

        // Win rate for completed trades
        const winningTrades = completedTrades.filter(t => calculateMetrics(t).pnl > 0).length;
        const winRate = completedTrades.length > 0 ? (winningTrades / completedTrades.length) * 100 : 0;

        // Average ROI for completed trades
        const avgRoi = completedTrades.length > 0
            ? completedTrades.reduce((acc, t) => acc + calculateMetrics(t).roi, 0) / completedTrades.length
            : 0;

        // Capital deployed (collateral for open trades)
        const capitalAtRisk = openTrades.reduce((acc, t) => acc + calculateMetrics(t).collateral, 0);

        return { totalPnL, tickerStats, monthlyStats, winRate, avgRoi, capitalAtRisk, openTradesCount: openTrades.length, completedTradesCount: completedTrades.length };
    }, [trades]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        if (trades.length === 0) return [];

        const sortedTrades = [...trades].sort((a, b) => new Date(a.openedDate) - new Date(b.openedDate));

        let cumulativePnL = 0;
        const data = sortedTrades.map(trade => {
            const { pnl } = calculateMetrics(trade);
            cumulativePnL += pnl;
            return {
                date: new Date(trade.openedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                fullDate: trade.openedDate,
                pnl: cumulativePnL,
                tradePnl: pnl,
                ticker: trade.ticker.toUpperCase()
            };
        });

        return data;
    }, [trades]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-sm">
                    <p className="font-semibold text-slate-700">{data.ticker}</p>
                    <p className="text-slate-500">{formatDate(data.fullDate)}</p>
                    <p className={`font-mono font-medium ${data.tradePnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        Trade: {formatCurrency(data.tradePnl)}
                    </p>
                    <p className={`font-mono font-bold ${data.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        Total: {formatCurrency(data.pnl)}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-500 font-medium">
                Loading your wheel...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Activity className="w-6 h-6 text-indigo-600" />
                            Optionable
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Documenting the Wheel Strategy</p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md shadow-indigo-200"
                    >
                        <Plus className="w-4 h-4" />
                        New Trade
                    </button>
                </header>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                        <span className="text-slate-500 text-sm font-medium uppercase tracking-wide">Profit & Loss</span>
                        <div className={`text-3xl font-bold mt-2 ${stats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(stats.totalPnL)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">For completed trades</div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                        <span className="text-slate-500 text-sm font-medium uppercase tracking-wide">Win Rate</span>
                        <div className="text-3xl font-bold mt-2 text-indigo-600">
                            {formatPercent(stats.winRate)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">For completed trades</div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                        <span className="text-slate-500 text-sm font-medium uppercase tracking-wide">Avg ROI</span>
                        <div className={`text-3xl font-bold mt-2 ${stats.avgRoi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatPercent(stats.avgRoi)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">For completed trades</div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                        <span className="text-slate-500 text-sm font-medium uppercase tracking-wide">Capital Deployed</span>
                        <div className="text-3xl font-bold mt-2 text-slate-700">
                            {formatCurrency(stats.capitalAtRisk)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Locked collateral for {stats.openTradesCount} open trade{stats.openTradesCount !== 1 ? 's' : ''}</div>
                    </div>
                </div>

                {/* P/L Chart */}
                {chartData.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                                Cumulative P/L
                            </h3>
                            <span className={`text-sm font-mono font-bold ${stats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(stats.totalPnL)}
                            </span>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={stats.totalPnL >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={stats.totalPnL >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        tickLine={{ stroke: '#e2e8f0' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        tickLine={{ stroke: '#e2e8f0' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                        tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="pnl"
                                        stroke={stats.totalPnL >= 0 ? "#10b981" : "#ef4444"}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorPnl)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* Main Table Area */}
                    <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                Trade Log
                            </h3>
                            <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
                                {trades.length} trades
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-3 py-3 font-semibold">Ticker</th>
                                        <th className="px-3 py-3 font-semibold">Type</th>
                                        <th className="px-3 py-3 font-semibold">Strike</th>
                                        <th className="px-3 py-3 font-semibold">Opened</th>
                                        <th className="px-3 py-3 font-semibold">Expiry</th>
                                        <th className="px-3 py-3 font-semibold text-center">DTE</th>
                                        <th className="px-3 py-3 font-semibold text-right">P/L</th>
                                        <th className="px-3 py-3 font-semibold text-right">ROI</th>
                                        <th className="px-3 py-3 font-semibold text-center">Status</th>
                                        <th className="px-3 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {trades.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="px-4 py-12 text-center text-slate-400">
                                                No trades yet. Click "New Trade" to start your wheel.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedTrades.map((trade) => {
                                            const metrics = calculateMetrics(trade);
                                            const dte = calculateDTE(trade.expirationDate, trade.status);
                                            return (
                                                <tr key={trade.id} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-3 py-3 font-bold text-slate-700">{trade.ticker.toUpperCase()}</td>
                                                    <td className="px-3 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${trade.type === 'CSP'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                            {trade.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 font-mono text-slate-600">${trade.strike}</td>
                                                    <td className="px-3 py-3 text-xs text-slate-500">
                                                        {formatDateShort(trade.openedDate)}
                                                    </td>
                                                    <td className="px-3 py-3 text-xs text-slate-500">
                                                        {formatDateShort(trade.expirationDate)}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {dte !== null ? (
                                                            <span className={`font-mono font-medium ${dte <= 3 ? 'text-red-600' :
                                                                dte <= 7 ? 'text-orange-600' :
                                                                    'text-slate-600'
                                                                }`}>
                                                                {dte}d
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 py-3 text-right font-mono font-medium ${metrics.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {formatCurrency(metrics.pnl)}
                                                    </td>
                                                    <td className={`px-3 py-3 text-right font-mono text-xs ${metrics.roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {formatPercent(metrics.roi)}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${trade.status === 'Open' ? 'bg-yellow-100 text-yellow-700' :
                                                            trade.status === 'Assigned' ? 'bg-orange-100 text-orange-700' :
                                                                trade.status === 'Expired' ? 'bg-green-100 text-green-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {trade.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right">
                                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => duplicateTrade(trade)}
                                                                className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                                                title="Duplicate trade"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openModal(trade)}
                                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                                title="Edit trade"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteTrade(trade.id)}
                                                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                                title="Delete trade"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="text-sm text-slate-500">
                                    Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} - {Math.min(currentPage * TRADES_PER_PAGE, trades.length)} of {trades.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-8 h-8 rounded-lg text-sm font-medium ${page === currentPage
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Summaries */}
                    <div className="space-y-6">

                        {/* By Month Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-3 border-b border-slate-100 bg-slate-50/50 font-semibold text-sm text-slate-700">
                                Monthly P/L
                            </div>
                            <div className="overflow-y-auto max-h-60">
                                {Object.keys(stats.monthlyStats).length === 0 ? (
                                    <div className="px-4 py-6 text-center text-slate-400 text-sm">No data yet</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-50">
                                            {Object.entries(stats.monthlyStats)
                                                .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                                                .map(([month, pnl]) => (
                                                    <tr key={month} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2 text-slate-600">{month}</td>
                                                        <td className={`px-4 py-2 text-right font-mono font-medium ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {formatCurrency(pnl)}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* By Ticker Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-3 border-b border-slate-100 bg-slate-50/50 font-semibold text-sm text-slate-700">
                                Ticker P/L
                            </div>
                            <div className="overflow-y-auto max-h-60">
                                {Object.keys(stats.tickerStats).length === 0 ? (
                                    <div className="px-4 py-6 text-center text-slate-400 text-sm">No data yet</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-50">
                                            {Object.entries(stats.tickerStats)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([ticker, pnl]) => (
                                                    <tr key={ticker} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2 font-bold text-slate-700">{ticker}</td>
                                                        <td className={`px-4 py-2 text-right font-mono font-medium ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {formatCurrency(pnl)}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-4 text-white">
                            <h4 className="font-bold text-lg mb-1">Wheel Strategy Tips</h4>
                            <ul className="text-xs space-y-2 opacity-90 list-disc pl-4">
                                <li>Sell CSPs on red days.</li>
                                <li>Sell CCs on green days.</li>
                                <li>Avoid earnings weeks if conservative.</li>
                                <li>Don't wheel stocks you don't want to own!</li>
                            </ul>
                        </div>

                    </div>
                </div>

            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="modal-enter bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingId ? 'Edit Trade' : 'New Trade'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={saveTrade} className="p-6 space-y-4">
                            <div className="grid grid-cols-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Ticker</label>
                                    <input
                                        type="text" name="ticker" required
                                        value={formData.ticker} onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                                        placeholder="e.g. SOXL"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Opened</label>
                                    <input type="date" name="openedDate" required value={formData.openedDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expiration</label>
                                    <input type="date" name="expirationDate" required value={formData.expirationDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Closed (Opt)</label>
                                    <input type="date" name="closedDate" value={formData.closedDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
                                    <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                                        <option value="CSP">CSP (Put)</option>
                                        <option value="CC">CC (Call)</option>
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Strike ($)</label>
                                    <input type="number" step="0.5" name="strike" required value={formData.strike} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="0.00" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Qty</label>
                                    <input type="number" name="quantity" required value={formData.quantity} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 text-emerald-600">Entry Premium ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                                        <input
                                            type="number" step="0.01" name="entryPrice" required
                                            value={formData.entryPrice} onChange={handleInputChange}
                                            className="w-full pl-7 pr-3 py-2 border border-emerald-200 rounded-lg focus:ring-emerald-500"
                                            placeholder="Price per share"
                                        />
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1 text-right">
                                        Total: {formatCurrency((formData.entryPrice || 0) * (formData.quantity || 0) * 100)}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 text-red-500">Close Cost ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                                        <input
                                            type="number" step="0.01" name="closePrice"
                                            value={formData.closePrice} onChange={handleInputChange}
                                            className="w-full pl-7 pr-3 py-2 border border-red-200 rounded-lg focus:ring-red-500"
                                            placeholder="0.00 if open"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['Open', 'Expired', 'Assigned', 'Closed'].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                                            className={`py-2 text-xs font-medium rounded-lg border ${formData.status === s
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 rounded-lg text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                                    {editingId ? 'Update Trade' : 'Save Trade'}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
