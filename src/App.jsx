import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';

// Shared utilities
import { API_URL, TRADES_PER_PAGE, APP_VERSION } from './utils/constants';
import { formatCurrency } from './utils/formatters';
import { calculateMetrics, calculateDaysHeld } from './utils/calculations';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useTrades } from './hooks/useTrades';

// Components
import {
    Toast,
    WelcomeModal,
    Header,
    Dashboard,
    PnLChart,
    TradeTable,
    SummaryCards,
    PositionsTable,
    SettingsModal
} from './components';

// --- Main Component ---
export default function App() {
    // Capital gains stats - defined early so it can be used in useTrades callback
    const [capitalGainsStats, setCapitalGainsStats] = useState({
        realizedCapitalGL: 0,
        openPositions: 0,
        closedPositions: 0
    });

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

    // Use hooks for trades and theme
    const { trades, loading, error, setError, fetchTrades, refreshAll } = useTrades(fetchCapitalGainsStats);
    const { darkMode, setDarkMode } = useTheme();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [showPositions, setShowPositions] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Form State
    const initialFormState = {
        ticker: '',
        openedDate: new Date().toISOString().split('T')[0],
        expirationDate: '',
        closedDate: '',
        strike: '',
        type: 'CSP',
        quantity: 1,
        delta: '',
        entryPrice: '',
        closePrice: '',
        status: 'Open',
        parentTradeId: null,
        notes: '',
    };
    const [formData, setFormData] = useState(initialFormState);
    const [isRolling, setIsRolling] = useState(false);
    const [rollFromTrade, setRollFromTrade] = useState(null);
    const [rollClosePrice, setRollClosePrice] = useState('');

    // Filter & Sort state
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'open', 'closed'
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
    const [chartPeriod, setChartPeriod] = useState('all'); // '1m', '3m', '6m', 'ytd', 'all'

    // App settings
    const [appSettings, setAppSettings] = useState({
        confirm_expire_enabled: 'true' // Default to true
    });

    // Toast state
    const [toast, setToast] = useState(null);

    // Show toast helper
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger if user is typing in an input or modal is open
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            // Escape - Close any modal
            if (e.key === 'Escape') {
                if (isModalOpen) closeModal();
                if (showPositions) setShowPositions(false);
                if (showSettings) setShowSettings(false);
                if (showHelp) setShowHelp(false);
                return;
            }

            // Don't process other shortcuts if any modal is open
            if (isModalOpen || showPositions || showSettings || showHelp) return;

            // N - New trade
            if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                openModal();
            }
            // P - Positions
            if (e.key === 'p' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setShowPositions(true);
            }
            // S - Settings
            if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setShowSettings(true);
            }
            // D - Toggle dark mode
            if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setDarkMode(prev => !prev);
            }
            // H - Help
            if (e.key === 'h' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setShowHelp(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, showPositions, showSettings, showHelp]);

    // --- Data Fetching ---
    const fetchSettings = async () => {
        try {
            const response = await fetch(`${API_URL}/settings`);
            if (!response.ok) return;
            const json = await response.json();
            if (json.success && json.data) {
                setAppSettings(json.data);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };

    useEffect(() => {
        fetchCapitalGainsStats();
        fetchSettings();
    }, [fetchCapitalGainsStats]);

    // --- Filtering & Sorting ---
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

    // --- Pagination ---
    const totalPages = Math.ceil(filteredAndSortedTrades.length / TRADES_PER_PAGE);
    const paginatedTrades = useMemo(() => {
        const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
        return filteredAndSortedTrades.slice(startIndex, startIndex + TRADES_PER_PAGE);
    }, [filteredAndSortedTrades, currentPage]);

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
        setIsRolling(false);
        setRollFromTrade(null);
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
                delta: trade.delta || '',
                entryPrice: trade.entryPrice,
                closePrice: trade.closePrice || '',
                status: trade.status,
                parentTradeId: trade.parentTradeId || null,
                notes: trade.notes || '',
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
        setIsRolling(false);
        setRollFromTrade(null);
        setFormData({
            ticker: trade.ticker,
            openedDate: new Date().toISOString().split('T')[0], // Today's date
            expirationDate: '', // Clear so user must enter new date
            closedDate: '',
            strike: trade.strike,
            type: trade.type,
            quantity: trade.quantity,
            delta: '', // Clear so user enters new delta
            entryPrice: '', // Clear so user enters new premium
            closePrice: '',
            status: 'Open',
            parentTradeId: null,
            notes: '',
        });
        setIsModalOpen(true);
    };

    // Roll trade - closes original at a cost and opens new position linked to it
    const rollTrade = (trade) => {
        setEditingId(null);
        setIsRolling(true);
        setRollFromTrade(trade);
        setRollClosePrice('');
        setFormData({
            ticker: trade.ticker,
            openedDate: new Date().toISOString().split('T')[0],
            expirationDate: '',
            closedDate: '',
            strike: '',
            type: trade.type,
            quantity: trade.quantity,
            delta: '',
            entryPrice: '',
            closePrice: '',
            status: 'Open',
            parentTradeId: trade.id,
            notes: '',
        });
        setIsModalOpen(true);
    };

    // Open a Covered Call on an assigned CSP
    const openCoveredCall = (cspTrade) => {
        setEditingId(null);
        setIsRolling(false);
        setRollFromTrade(null);
        setFormData({
            ticker: cspTrade.ticker,
            openedDate: new Date().toISOString().split('T')[0],
            expirationDate: '',
            closedDate: '',
            strike: '',
            type: 'CC',
            quantity: cspTrade.quantity,
            delta: '',
            entryPrice: '',
            closePrice: '',
            status: 'Open',
            parentTradeId: cspTrade.id,
            notes: '',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFormData(initialFormState);
        setEditingId(null);
        setIsRolling(false);
        setRollFromTrade(null);
        setRollClosePrice('');
    };

    const saveTrade = async (e) => {
        e.preventDefault();

        // Validation for rolling
        if (isRolling && rollFromTrade) {
            if (!rollClosePrice && rollClosePrice !== 0) {
                setError('Please enter the close cost for the original position');
                return;
            }
            if (!formData.strike) {
                setError('Please enter the new strike price');
                return;
            }
            if (!formData.entryPrice) {
                setError('Please enter the new premium');
                return;
            }
            if (!formData.expirationDate) {
                setError('Please enter the new expiration date');
                return;
            }
        }

        const tradeData = {
            ticker: formData.ticker,
            type: formData.type,
            strike: Number(formData.strike),
            quantity: Number(formData.quantity),
            delta: formData.delta ? Number(formData.delta) : null,
            entryPrice: Number(formData.entryPrice),
            closePrice: formData.closePrice ? Number(formData.closePrice) : 0,
            openedDate: formData.openedDate,
            expirationDate: formData.expirationDate,
            closedDate: formData.closedDate || null,
            status: formData.status,
            parentTradeId: formData.parentTradeId || null,
            notes: formData.notes || null,
        };

        try {
            // If rolling, use atomic roll endpoint
            if (isRolling && rollFromTrade) {
                const response = await fetch(`${API_URL}/trades/roll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originalTradeId: rollFromTrade.id,
                        closePrice: Number(rollClosePrice),
                        newTrade: tradeData,
                    }),
                });

                if (!response.ok) throw new Error('Failed to roll trade');
            } else {
                const url = editingId ? `${API_URL}/trades/${editingId}` : `${API_URL}/trades`;
                const method = editingId ? 'PUT' : 'POST';

                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tradeData),
                });

                if (!response.ok) throw new Error('Failed to save trade');
            }

            await refreshAll();
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
            await refreshAll();
            showToast('Trade deleted');
        } catch (err) {
            console.error('Error deleting trade:', err);
            setError('Failed to delete trade. Please try again.');
        }
    };

    // Quick close trade at $0 (for expired options)
    const quickCloseTrade = async (trade) => {
        try {
            const response = await fetch(`${API_URL}/trades/${trade.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...trade,
                    closePrice: 0,
                    closedDate: new Date().toISOString().split('T')[0],
                    status: 'Expired',
                }),
            });
            if (!response.ok) throw new Error('Failed to close trade');
            await refreshAll();
            showToast(`${trade.ticker} closed at $0`);
        } catch (err) {
            console.error('Error closing trade:', err);
            setError('Failed to close trade. Please try again.');
        }
    };

    // --- CSV Export ---
    const exportToCSV = () => {
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
    };

    // --- CSV Import ---
    const importFromCSV = async (event) => {
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
    };

    // --- Aggregation Logic ---
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
        // Find chain roots (trades with no parent)
        const chainRoots = filteredTrades.filter(t => !t.parentTradeId);

        // Calculate chain P/L for each root
        const chains = chainRoots.map(root => {
            let chainPnL = calculateMetrics(root).pnl;
            let finalStatus = root.status;
            let currentId = root.id;

            // Follow the chain forward (find children)
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

        // Only count resolved chains for win rate
        const resolvedChains = chains.filter(c => c.isResolved);
        const winningChains = resolvedChains.filter(c => c.chainPnL > 0).length;
        const winRate = resolvedChains.length > 0 ? (winningChains / resolvedChains.length) * 100 : 0;

        // Average ROI for completed trades (terminal states only)
        const avgRoi = completedTrades.length > 0
            ? completedTrades.reduce((acc, t) => acc + calculateMetrics(t).roi, 0) / completedTrades.length
            : 0;

        // Capital deployed (collateral for open CSPs only - CCs use owned shares, not cash)
        const capitalAtRisk = openTrades
            .filter(t => t.type === 'CSP')
            .reduce((acc, t) => acc + calculateMetrics(t).collateral, 0);

        // Count rolled trades
        const rolledCount = filteredTrades.filter(t => t.status === 'Rolled').length;

        // Net premium collected (only closed trades, not open) - premium minus close costs
        const totalPremiumCollected = allClosedTrades.reduce((acc, t) => {
            const { pnl } = calculateMetrics(t);
            return acc + pnl;
        }, 0);

        // Best performing ticker
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
            // Capital gains from positions
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

    // --- Chart Data (only completed trades) ---
    const chartData = useMemo(() => {
        // Only include trades that are not Open (completed or rolled)
        let completedTrades = trades.filter(t => t.status !== 'Open');
        if (completedTrades.length === 0) return [];

        // Filter by time period
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
            // Sort by closed date if available, otherwise by opened date
            const dateA = a.closedDate || a.expirationDate || a.openedDate;
            const dateB = b.closedDate || b.expirationDate || b.openedDate;
            return new Date(dateA) - new Date(dateB);
        });

        let cumulativePnL = 0;
        const data = sortedTrades.map(trade => {
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

        return data;
    }, [trades, chartPeriod]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header skeleton */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 animate-pulse">
                        <div className="flex justify-between items-center">
                            <div className="space-y-2">
                                <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            </div>
                            <div className="flex gap-2">
                                <div className="h-10 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                                <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                            </div>
                        </div>
                    </div>
                    {/* KPI cards skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 animate-pulse">
                                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-3"></div>
                                <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                    {/* Chart skeleton */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 animate-pulse">
                        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-200 transition-colors">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Header */}
                <Header
                    darkMode={darkMode}
                    onToggleTheme={() => setDarkMode(!darkMode)}
                    onExport={exportToCSV}
                    onImport={importFromCSV}
                    onNewTrade={() => openModal()}
                    onOpenPositions={() => setShowPositions(true)}
                    onOpenSettings={() => setShowSettings(true)}
                    version={APP_VERSION}
                />

                {/* Dashboard Grid */}
                <Dashboard stats={stats} />

                {/* P/L Chart */}
                <PnLChart
                    chartData={chartData}
                    chartPeriod={chartPeriod}
                    onPeriodChange={setChartPeriod}
                    totalPnL={stats.totalPnL}
                    darkMode={darkMode}
                />

                {/* Trade Table */}
                <TradeTable
                    trades={trades}
                    filteredAndSortedTrades={filteredAndSortedTrades}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    onQuickClose={quickCloseTrade}
                    onRoll={rollTrade}
                    onEdit={openModal}
                    onDelete={deleteTrade}
                    onOpenCC={openCoveredCall}
                    confirmExpireEnabled={appSettings.confirm_expire_enabled !== 'false'}
                    livePricesEnabled={appSettings.live_prices_enabled === 'true'}
                />

                {/* Summary Cards */}
                <SummaryCards stats={stats} />

            </div>

            {/* Toast Notification */}
            <Toast toast={toast} onClose={() => setToast(null)} />

            {/* Welcome/Help Modal */}
            <WelcomeModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
                    <div className="modal-enter bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full max-w-xl overflow-hidden my-8">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                    {editingId ? 'Edit Trade' : isRolling ? 'Roll Trade' : 'New Trade'}
                                </h2>
                                {isRolling && rollFromTrade && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3" />
                                        Rolling {rollFromTrade.ticker} ${rollFromTrade.strike} {rollFromTrade.type}
                                    </p>
                                )}
                            </div>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={saveTrade} className="p-6 space-y-4">

                            {/* Original Trade Close Section (only when rolling) */}
                            {isRolling && rollFromTrade && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                    <h3 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4" />
                                        Close Original Position
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <span className="text-amber-600 text-xs">Ticker</span>
                                            <p className="font-bold text-amber-900">{rollFromTrade.ticker}</p>
                                        </div>
                                        <div>
                                            <span className="text-amber-600 text-xs">Strike</span>
                                            <p className="font-bold text-amber-900">${rollFromTrade.strike}</p>
                                        </div>
                                        <div>
                                            <span className="text-amber-600 text-xs">Entry Premium</span>
                                            <p className="font-bold text-emerald-600">${rollFromTrade.entryPrice}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-amber-700 uppercase mb-1">
                                            Close Cost (per share) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-amber-400">$</span>
                                            <input
                                                type="number" step="0.01" required
                                                value={rollClosePrice}
                                                onChange={(e) => setRollClosePrice(e.target.value)}
                                                className="w-full pl-7 pr-3 py-2 border border-amber-300 rounded-lg focus:ring-amber-500 bg-white"
                                                placeholder="Cost to buy back original"
                                            />
                                        </div>
                                        <div className="text-xs text-amber-600 mt-1">
                                            Original P/L: {formatCurrency((rollFromTrade.entryPrice - (Number(rollClosePrice) || 0)) * rollFromTrade.quantity * 100)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* New Trade Section Header (only when rolling) */}
                            {isRolling && (
                                <div className="border-t border-slate-200 pt-4">
                                    <h3 className="font-semibold text-indigo-700 text-sm mb-3">New Rolled Position</h3>
                                </div>
                            )}

                            <div className="grid grid-cols-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Ticker</label>
                                    <input
                                        type="text" name="ticker" required
                                        value={formData.ticker} onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                        placeholder="e.g. SOXL"
                                        readOnly={isRolling}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Opened</label>
                                    <input type="date" name="openedDate" required value={formData.openedDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Expiration *</label>
                                    <input type="date" name="expirationDate" required value={formData.expirationDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Closed (Opt)</label>
                                    <input type="date" name="closedDate" value={formData.closedDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                                    <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" disabled={isRolling}>
                                        <option value="CSP">CSP (Put)</option>
                                        <option value="CC">CC (Call)</option>
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">New Strike *</label>
                                    <input type="number" step="0.5" name="strike" required value={formData.strike} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" placeholder="0.00" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Qty</label>
                                    <input type="number" name="quantity" required value={formData.quantity} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Delta</label>
                                    <input type="number" step="0.01" min="0" max="1" name="delta" value={formData.delta} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" placeholder="0.30" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-600">
                                <div>
                                    <label className="block text-xs font-semibold uppercase mb-1 text-emerald-600 dark:text-emerald-400">
                                        {isRolling ? 'New Premium *' : 'Entry Premium ($)'}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                                        <input
                                            type="number" step="0.01" name="entryPrice" required
                                            value={formData.entryPrice} onChange={handleInputChange}
                                            className="w-full pl-7 pr-3 py-2 border border-emerald-200 dark:border-emerald-700 rounded-lg focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                            placeholder="Price per share"
                                        />
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1 text-right">
                                        Total: {formatCurrency((formData.entryPrice || 0) * (formData.quantity || 0) * 100)}
                                    </div>
                                </div>

                                {!isRolling && (
                                    <div>
                                        <label className="block text-xs font-semibold uppercase mb-1 text-red-500 dark:text-red-400">Close Cost ($)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                                            <input
                                                type="number" step="0.01" name="closePrice"
                                                value={formData.closePrice} onChange={handleInputChange}
                                                className="w-full pl-7 pr-3 py-2 border border-red-200 dark:border-red-700 rounded-lg focus:ring-red-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                                placeholder="0.00 if open"
                                            />
                                        </div>
                                    </div>
                                )}

                                {isRolling && (
                                    <div className="flex flex-col justify-center">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">Net Credit/Debit</div>
                                        <div className={`text-xl font-bold ${((Number(formData.entryPrice) || 0) - (Number(rollClosePrice) || 0)) >= 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            {formatCurrency(((Number(formData.entryPrice) || 0) - (Number(rollClosePrice) || 0)) * (formData.quantity || 1) * 100)}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {((Number(formData.entryPrice) || 0) - (Number(rollClosePrice) || 0)) >= 0 ? 'Credit' : 'Debit'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                                    placeholder="Optional notes about this trade..."
                                />
                            </div>

                            {!isRolling && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['Open', 'Expired', 'Assigned', 'Closed'].map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                                                className={`py-2 text-xs font-medium rounded-lg border ${formData.status === s
                                                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500'
                                                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Use the Roll button to roll a trade</p>
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 rounded-lg text-white font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600">
                                    {editingId ? 'Update Trade' : isRolling ? 'Roll & Create New' : 'Save Trade'}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

            {/* Positions Modal */}
            {showPositions && (
                <PositionsTable
                    onClose={() => setShowPositions(false)}
                    showToast={showToast}
                />
            )}

            {/* Settings Modal */}
            {showSettings && (
                <SettingsModal
                    onClose={() => { setShowSettings(false); fetchSettings(); }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
