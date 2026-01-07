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
    ChevronRight,
    RefreshCw,
    Link2,
    Download,
    Upload,
    Moon,
    Sun,
    Check,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    DollarSign,
    Target,
    Clock,
    Keyboard
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
        delta: '',
        entryPrice: '',
        closePrice: '',
        status: 'Open',
        parentTradeId: null,
    };
    const [formData, setFormData] = useState(initialFormState);
    const [isRolling, setIsRolling] = useState(false);
    const [rollFromTrade, setRollFromTrade] = useState(null);
    const [rollClosePrice, setRollClosePrice] = useState('');

    // Filter & Sort state
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'open', 'closed'
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
    const [chartPeriod, setChartPeriod] = useState('all'); // '1m', '3m', '6m', 'ytd', 'all'

    // Toast state
    const [toast, setToast] = useState(null);

    // Show toast helper
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Theme state (dark mode is default)
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            return saved !== 'light'; // Default to dark unless explicitly set to light
        }
        return true;
    });

    // Apply dark mode class to document
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            // N - New trade
            if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                openModal();
            }
            // Escape - Close modal
            if (e.key === 'Escape' && isModalOpen) {
                closeModal();
            }
            // D - Toggle dark mode
            if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setDarkMode(prev => !prev);
            }
            // ? - Show shortcuts help
            if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                showToast('Shortcuts: N=New trade, D=Dark mode, Esc=Close');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);

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
            result = [...result].sort((a, b) => {
                let aVal, bVal;

                if (sortConfig.key === 'pnl' || sortConfig.key === 'roi' || sortConfig.key === 'annualizedRoi') {
                    const aMetrics = calculateMetrics(a);
                    const bMetrics = calculateMetrics(b);
                    aVal = aMetrics[sortConfig.key];
                    bVal = bMetrics[sortConfig.key];
                } else if (sortConfig.key === 'daysHeld') {
                    aVal = calculateDaysHeld(a);
                    bVal = calculateDaysHeld(b);
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

    // Sort handler
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Get sort icon for column
    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3" />
            : <ArrowDown className="w-3 h-3" />;
    };

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
        };

        try {
            // If rolling, first update the original trade to 'Rolled' status
            if (isRolling && rollFromTrade) {
                const updateOriginal = await fetch(`${API_URL}/trades/${rollFromTrade.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...rollFromTrade,
                        closePrice: Number(rollClosePrice),
                        closedDate: formData.openedDate,
                        status: 'Rolled',
                    }),
                });

                if (!updateOriginal.ok) throw new Error('Failed to update original trade');
            }

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
            await fetchTrades();
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

        const headers = ['id', 'ticker', 'type', 'strike', 'quantity', 'delta', 'entryPrice', 'closePrice', 'openedDate', 'expirationDate', 'closedDate', 'status', 'parentTradeId'];

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
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                setError('CSV file is empty or invalid');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const requiredHeaders = ['ticker', 'type', 'strike', 'entryPrice', 'openedDate', 'expirationDate', 'status'];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

            if (missingHeaders.length > 0) {
                setError(`Missing required columns: ${missingHeaders.join(', ')}`);
                return;
            }

            const tradesToImport = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const trade = {};
                headers.forEach((header, index) => {
                    trade[header] = values[index] || null;
                });

                // Validate and convert types
                tradesToImport.push({
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
                });
            }

            // Import trades via API
            const response = await fetch(`${API_URL}/trades/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trades: tradesToImport }),
            });

            if (!response.ok) throw new Error('Failed to import trades');

            const result = await response.json();
            await fetchTrades();
            alert(`Successfully imported ${result.imported} trades!`);
        } catch (err) {
            console.error('Error importing CSV:', err);
            setError('Failed to import CSV. Please check the file format.');
        }

        // Reset file input
        event.target.value = '';
    };

    // --- Aggregation Logic ---
    const stats = useMemo(() => {
        // Completed trades = not Open and not Rolled (terminal states only)
        const completedTrades = trades.filter(t => t.status !== 'Open' && t.status !== 'Rolled');
        const openTrades = trades.filter(t => t.status === 'Open');

        // P/L for all non-open trades (includes Rolled for accurate total)
        const allClosedTrades = trades.filter(t => t.status !== 'Open');
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
        const chainRoots = trades.filter(t => !t.parentTradeId);

        // Calculate chain P/L for each root
        const chains = chainRoots.map(root => {
            let chainPnL = calculateMetrics(root).pnl;
            let finalStatus = root.status;
            let currentId = root.id;

            // Follow the chain forward (find children)
            let child = trades.find(t => t.parentTradeId === currentId);
            while (child) {
                chainPnL += calculateMetrics(child).pnl;
                finalStatus = child.status;
                currentId = child.id;
                child = trades.find(t => t.parentTradeId === currentId);
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

        // Capital deployed (collateral for open trades)
        const capitalAtRisk = openTrades.reduce((acc, t) => acc + calculateMetrics(t).collateral, 0);

        // Count rolled trades
        const rolledCount = trades.filter(t => t.status === 'Rolled').length;

        // Total premium collected (all trades)
        const totalPremiumCollected = trades.reduce((acc, t) => {
            const { totalPremium } = calculateMetrics(t);
            return acc + totalPremium;
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
            resolvedChains: resolvedChains.length,
            rolledCount,
            totalPremiumCollected,
            bestTicker
        };
    }, [trades]);

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

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-sm">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{data.ticker}</p>
                    <p className="text-slate-500 dark:text-slate-400">{formatDate(data.fullDate)}</p>
                    <p className={`font-mono font-medium ${data.tradePnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        Trade: {formatCurrency(data.tradePnl)}
                    </p>
                    <p className={`font-mono font-bold ${data.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        Total: {formatCurrency(data.pnl)}
                    </p>
                </div>
            );
        }
        return null;
    };

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
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            Optionable
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Documenting the Wheel Strategy</p>
                    </div>
                    <div className="mt-4 md:mt-0 flex items-center gap-2">
                        {/* Theme Toggle */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        {/* Export Button */}
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-medium transition-colors"
                            title="Export to CSV"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>

                        {/* Import Button */}
                        <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer" title="Import from CSV">
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:inline">Import</span>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={importFromCSV}
                                className="hidden"
                            />
                        </label>

                        {/* New Trade Button */}
                        <button
                            onClick={() => openModal()}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Trade
                        </button>
                    </div>
                </header>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Total P/L</span>
                        <div className={`text-2xl font-bold mt-1 ${stats.totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(stats.totalPnL)}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stats.completedTradesCount} closed</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Premium</span>
                        <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(stats.totalPremiumCollected)}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Total collected</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Win Rate</span>
                        <div className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                            {formatPercent(stats.winRate)}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stats.resolvedChains} chains</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Avg ROI</span>
                        <div className={`text-2xl font-bold mt-1 ${stats.avgRoi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatPercent(stats.avgRoi)}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Per trade</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Capital</span>
                        <div className="text-2xl font-bold mt-1 text-slate-700 dark:text-slate-200">
                            {formatCurrency(stats.capitalAtRisk)}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stats.openTradesCount} open</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Best Ticker</span>
                        <div className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                            {stats.bestTicker ? stats.bestTicker.ticker : '—'}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {stats.bestTicker ? formatCurrency(stats.bestTicker.pnl) : 'No data'}
                        </div>
                    </div>
                </div>

                {/* P/L Chart */}
                {chartData.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                                Cumulative P/L
                            </h3>
                            <div className="flex items-center gap-3">
                                {/* Time Period Selector */}
                                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                                    {[
                                        { key: '1m', label: '1M' },
                                        { key: '3m', label: '3M' },
                                        { key: '6m', label: '6M' },
                                        { key: 'ytd', label: 'YTD' },
                                        { key: 'all', label: 'All' }
                                    ].map(period => (
                                        <button
                                            key={period.key}
                                            onClick={() => setChartPeriod(period.key)}
                                            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                                chartPeriod === period.key
                                                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            {period.label}
                                        </button>
                                    ))}
                                </div>
                                <span className={`text-sm font-mono font-bold ${stats.totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(stats.totalPnL)}
                                </span>
                            </div>
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
                                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                                        tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                                        axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                                        tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                                        axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
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

                {/* Main Table Area - Full Width */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                Trade Log
                            </h3>
                            <div className="flex items-center gap-3">
                                {/* Status Filter Tabs */}
                                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'open', label: 'Open' },
                                        { key: 'closed', label: 'Closed' }
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); }}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                                statusFilter === tab.key
                                                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {/* Clear Filters Button */}
                                {(statusFilter !== 'all' || sortConfig.key) && (
                                    <button
                                        onClick={() => { setStatusFilter('all'); setSortConfig({ key: null, direction: 'desc' }); setCurrentPage(1); }}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                        Clear
                                    </button>
                                )}
                                <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                    {filteredAndSortedTrades.length} trades
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('ticker')}>
                                            <span className="inline-flex items-center gap-1">Ticker {getSortIcon('ticker')}</span>
                                        </th>
                                        <th className="px-3 py-2 font-semibold">Type</th>
                                        <th className="px-3 py-2 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('strike')}>
                                            <span className="inline-flex items-center gap-1">Strike {getSortIcon('strike')}</span>
                                        </th>
                                        <th className="px-3 py-2 font-semibold text-center">Qty</th>
                                        <th className="px-3 py-2 font-semibold text-center">Delta</th>
                                        <th className="px-3 py-2 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('openedDate')}>
                                            <span className="inline-flex items-center gap-1">Opened {getSortIcon('openedDate')}</span>
                                        </th>
                                        <th className="px-3 py-2 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('expirationDate')}>
                                            <span className="inline-flex items-center gap-1">Expiry {getSortIcon('expirationDate')}</span>
                                        </th>
                                        <th className="px-3 py-2 font-semibold text-center">DTE</th>
                                        <th className="px-3 py-2 font-semibold text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('pnl')}>
                                            <span className="inline-flex items-center gap-1 justify-end">P/L {getSortIcon('pnl')}</span>
                                        </th>
                                        <th className="px-3 py-2 font-semibold text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('roi')}>
                                            <span className="inline-flex items-center gap-1 justify-end">ROI {getSortIcon('roi')}</span>
                                        </th>
                                        <th className="px-3 py-2 font-semibold text-center">Status</th>
                                        <th className="px-3 py-2 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredAndSortedTrades.length === 0 ? (
                                        <tr>
                                            <td colSpan="12" className="px-4 py-12 text-center text-sm text-slate-400">
                                                {trades.length === 0 ? "No trades yet. Click \"New Trade\" to start your wheel." : "No trades match the current filter."}
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedTrades.map((trade) => {
                                            const metrics = calculateMetrics(trade);
                                            const dte = calculateDTE(trade.expirationDate, trade.status);
                                            const hasChild = chainInfo.parentToChild.has(trade.id);
                                            const hasParent = chainInfo.childToParent.has(trade.id);
                                            const isPartOfChain = hasChild || hasParent;
                                            return (
                                                <tr key={trade.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                        <div className="flex items-center gap-1">
                                                            {trade.ticker.toUpperCase()}
                                                            {isPartOfChain && (
                                                                <Link2
                                                                    className="w-3 h-3 text-amber-500"
                                                                    title={hasParent ? "Rolled from previous" : "Rolled to next"}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${trade.type === 'CSP'
                                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                                                            : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400'
                                                            }`}>
                                                            {trade.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-300">${trade.strike}</td>
                                                    <td className="px-3 py-2 text-center font-mono text-sm text-slate-600 dark:text-slate-300">{trade.quantity}</td>
                                                    <td className="px-3 py-2 text-center font-mono text-sm text-slate-500 dark:text-slate-400">
                                                        {trade.delta ? trade.delta.toFixed(2) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                                                        {formatDateShort(trade.openedDate)}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                                                        {formatDateShort(trade.expirationDate)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {dte !== null ? (
                                                            <span className={`font-mono text-sm font-medium ${dte <= 3 ? 'text-red-600 dark:text-red-400' :
                                                                dte <= 7 ? 'text-orange-600 dark:text-orange-400' :
                                                                    'text-slate-600 dark:text-slate-300'
                                                                }`}>
                                                                {dte}d
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 py-2 text-right font-mono text-sm font-medium ${metrics.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                        {formatCurrency(metrics.pnl)}
                                                    </td>
                                                    <td className={`px-3 py-2 text-right font-mono text-sm ${metrics.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                        {formatPercent(metrics.roi)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${trade.status === 'Open' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20' :
                                                            trade.status === 'Assigned' ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-600/20' :
                                                                trade.status === 'Expired' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20' :
                                                                    trade.status === 'Rolled' ? 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/20' :
                                                                        'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                                                            }`}>
                                                            {trade.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {trade.status === 'Open' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => quickCloseTrade(trade)}
                                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                                                                        title="Close at $0 (expired)"
                                                                    >
                                                                        <Check className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => rollTrade(trade)}
                                                                        className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded"
                                                                        title="Roll trade"
                                                                    >
                                                                        <RefreshCw className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => duplicateTrade(trade)}
                                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                                                title="Duplicate trade"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openModal(trade)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                                                title="Edit trade"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteTrade(trade.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
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
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    Showing {((currentPage - 1) * TRADES_PER_PAGE) + 1} - {Math.min(currentPage * TRADES_PER_PAGE, filteredAndSortedTrades.length)} of {filteredAndSortedTrades.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-8 h-8 rounded-lg text-sm font-medium ${page === currentPage
                                                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                </div>

                {/* Summary Cards - Horizontal Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* By Month Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-semibold text-sm text-slate-700 dark:text-slate-200">
                            Monthly P/L
                        </div>
                        <div className="overflow-y-auto max-h-48">
                            {Object.keys(stats.monthlyStats).length === 0 ? (
                                <div className="px-4 py-6 text-center text-slate-400 text-sm">No data yet</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                        {Object.entries(stats.monthlyStats)
                                            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                                            .map(([month, pnl]) => (
                                                <tr key={month} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">{month}</td>
                                                    <td className={`px-4 py-2 text-right font-mono text-sm font-medium ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
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
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-semibold text-sm text-slate-700 dark:text-slate-200">
                            Ticker P/L
                        </div>
                        <div className="overflow-y-auto max-h-48">
                            {Object.keys(stats.tickerStats).length === 0 ? (
                                <div className="px-4 py-6 text-center text-slate-400 text-sm">No data yet</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                        {Object.entries(stats.tickerStats)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([ticker, pnl]) => (
                                                <tr key={ticker} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{ticker}</td>
                                                    <td className={`px-4 py-2 text-right font-mono text-sm font-medium ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {formatCurrency(pnl)}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Tips Card */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 p-4">
                        <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-300 mb-3">Wheel Strategy Tips</h4>
                        <ul className="text-sm space-y-2 text-indigo-700 dark:text-indigo-400 list-disc pl-4">
                            <li>Sell CSPs on red days.</li>
                            <li>Sell CCs on green days.</li>
                            <li>Avoid earnings weeks if conservative.</li>
                            <li>Don't wheel stocks you don't want to own!</li>
                        </ul>
                    </div>
                </div>

            </div>

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2 animate-in slide-in-from-bottom-2 ${
                    toast.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-900/90 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : toast.type === 'error'
                        ? 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                    {toast.type === 'success' && <Check className="w-4 h-4" />}
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

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
        </div>
    );
}
