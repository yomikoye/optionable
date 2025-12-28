import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    Upload
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
    const [importFormat, setImportFormat] = useState('auto'); // 'auto' | 'optionable' | 'activity'
    const [importPreview, setImportPreview] = useState([]); // trades parsed and ready to preview
    const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
    const [importFileName, setImportFileName] = useState('');
    const fileInputRef = useRef(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [showTrades, setShowTrades] = useState(false);

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

    // chart data: sum pnl by openedDate for a simple P&L over time view
    const chartData = useMemo(() => {
        if (!trades || trades.length === 0) return [];
        const byDate = {};
        trades.forEach(t => {
            const d = t.openedDate || '';
            const m = calculateMetrics(t);
            byDate[d] = (byDate[d] || 0) + (m.pnl || 0);
        });
        return Object.keys(byDate).sort().map(date => ({ date, pnl: byDate[date] }));
    }, [trades]);

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
        } catch (err) {
            console.error('Error deleting trade:', err);
            setError('Failed to delete trade. Please try again.');
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

    // --- CSV import + editable preview helpers ---
    const parseCSV = (text) => {
        const parseLine = (line) => {
            const values = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (ch === ',' && !inQuotes) {
                    values.push(cur);
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            values.push(cur);
            return values.map(v => v.trim().replace(/^"|"$/g, ''));
        };
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length === 0) return { headers: [], rows: [] };
        const headers = parseLine(lines[0]).map(h => h.trim());
        const rows = lines.slice(1).map(l => parseLine(l));
        return { headers, rows };
    };

    const normalizeKey = k => (k || '').replace(/\s+/g, '').toLowerCase();
    const cleanNumber = (s) => {
        if (s === undefined || s === null) return NaN;
        const str = String(s).trim();
        if (!str) return NaN;
        let cleaned = str.replace(/\$/g, '').replace(/,/g, '');
        const isParenNeg = /^\(.*\)$/.test(cleaned);
        cleaned = cleaned.replace(/^\(|\)$/g, '');
        const n = Number(cleaned);
        if (isNaN(n)) return NaN;
        return isParenNeg ? -Math.abs(n) : n;
    };
    const parseDateString = (s) => {
        if (!s) return null;
        const d = new Date(s);
        if (!isNaN(d)) return d.toISOString().split('T')[0];
        const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (m) {
            let yr = m[3].length === 2 ? `20${m[3]}` : m[3];
            const mm = String(Number(m[1])).padStart(2, '0');
            const dd = String(Number(m[2])).padStart(2, '0');
            return `${yr}-${mm}-${dd}`;
        }
        return null;
    };
    const normalizeDescription = (s) => (s || '').replace(/\$/g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const parseInstrument = (instr = '', desc = '') => {
        const s = `${instr || ''} ${desc || ''}`;
        const result = { ticker: null, strike: null, type: null, expirationDate: null };
        const tk = s.match(/\b([A-Z]{1,6})\b/i);
        if (tk) result.ticker = tk[1].toUpperCase();
        const typeMatch = s.match(/\b(PUT|CALL|P|C)\b/i);
        if (typeMatch) {
            const t = typeMatch[1].toLowerCase();
            result.type = t.startsWith('p') ? 'CSP' : 'CC';
        }
        const strikeMatch = s.match(/(?:\$)?(\d{1,5}(?:\.\d+)?)(?![\/\d])/g);
        if (strikeMatch && strikeMatch.length) {
            for (let i = strikeMatch.length - 1; i >= 0; i--) {
                const n = strikeMatch[i].replace('$', '');
                if (!n.includes('/')) {
                    result.strike = Number(n);
                    break;
                }
            }
        }
        const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
        const dateMatch = s.match(dateRegex);
        if (dateMatch) result.expirationDate = parseDateString(dateMatch[0]);
        return result;
    };

    // replace original import: parse, build preview (editable) and open modal
    const importFromCSV = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setImportFileName(file.name);
        try {
            const text = await file.text();
            const { headers, rows } = parseCSV(text);
            if (headers.length === 0 || rows.length === 0) {
                setError('CSV file is empty or invalid');
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            const norm = headers.map(h => normalizeKey(h));
            const looksLikeActivity = norm.includes('activitydate') || norm.includes('instrument') || norm.includes('transcode');
            const format = importFormat === 'auto' ? (looksLikeActivity ? 'activity' : 'optionable') : importFormat;

            const parsedTrades = [];

            if (format === 'activity') {
                // build activities
                const activities = rows.map(vals => {
                    const r = {};
                    headers.forEach((h, i) => r[normalizeKey(h)] = vals[i] || '');
                    const activityDate = parseDateString(r['activitydate'] || r['activity date'] || '');
                    const parsed = parseInstrument(r['instrument'] || '', r['description'] || '');
                    const price = cleanNumber(r['price']);
                    const amount = cleanNumber(r['amount']);
                    const qty = Number(r['quantity'] || r['qty'] || 1) || 1;
                    const computedPrice = !isNaN(price) && price !== 0 ? price : (!isNaN(amount) && qty ? Math.abs(amount) / (qty * 100) : 0);
                    return {
                        rowObj: r,
                        parsed,
                        activityDate,
                        transCode: (r['transcode'] || r['trans code'] || '').toUpperCase(),
                        computedPrice,
                        qty,
                        descNorm: normalizeDescription(r['description'] || '')
                    };
                });

                // create STO put trades (initial)
                const stoTrades = [];
                activities.forEach((a, i) => {
                    if (a.transCode === 'STO' && a.descNorm.includes('put')) {
                        stoTrades.push({
                            activityIndex: i,
                            ticker: a.parsed.ticker,
                            type: a.parsed.type || 'CSP',
                            strike: a.parsed.strike || 0,
                            quantity: a.qty || 1,
                            entryPrice: a.computedPrice || 0,
                            openedDate: a.activityDate || new Date().toISOString().split('T')[0],
                            expirationDate: a.parsed.expirationDate || '',
                            closedDate: null,
                            closePrice: 0,
                            status: 'Open',
                        });
                    }
                });

                // find matching BTCs (stricter matching previously requested)
                const usedBtc = new Set();
                stoTrades.forEach((sto) => {
                    const a = activities[sto.activityIndex];
                    if (!a) return;
                    for (let i = 0; i < activities.length; i++) {
                        if (usedBtc.has(i)) continue;
                        const cand = activities[i];
                        if (cand.transCode !== 'BTC') continue;
                        if (cand.descNorm !== a.descNorm) continue;
                        if (sto.strike && cand.parsed.strike && sto.strike !== cand.parsed.strike) continue;
                        if (sto.expirationDate && cand.parsed.expirationDate && sto.expirationDate !== cand.parsed.expirationDate) continue;
                        if (cand.activityDate && a.activityDate && new Date(cand.activityDate) < new Date(a.activityDate)) continue;
                        usedBtc.add(i);
                        sto.closedDate = cand.activityDate;
                        sto.closePrice = cand.computedPrice || sto.entryPrice;
                        sto.status = 'Rolled';
                        break;
                    }
                });

                stoTrades.forEach(s => {
                    parsedTrades.push({
                        ticker: s.ticker || '',
                        type: s.type,
                        strike: Number(s.strike) || 0,
                        quantity: Number(s.quantity) || 1,
                        delta: null,
                        entryPrice: Number(s.entryPrice) || 0,
                        closePrice: Number(s.closePrice) || 0,
                        openedDate: s.openedDate,
                        expirationDate: s.expirationDate || '',
                        closedDate: s.closedDate || null,
                        status: s.status || 'Open',
                        parentTradeId: null,
                    });
                });

            } else {
                // legacy optionable CSV
                for (const vals of rows) {
                    const r = {};
                    headers.forEach((h, idx) => r[normalizeKey(h)] = vals[idx] || '');
                    parsedTrades.push({
                        ticker: r['ticker'] || '',
                        type: r['type'] || 'CSP',
                        strike: Number(r['strike']) || 0,
                        quantity: Number(r['quantity']) || 1,
                        delta: r['delta'] ? Number(r['delta']) : null,
                        entryPrice: Number(r['entryprice']) || 0,
                        closePrice: Number(r['closeprice']) || 0,
                        openedDate: r['openeddate'] || new Date().toISOString().split('T')[0],
                        expirationDate: r['expirationdate'] || '',
                        closedDate: r['closeddate'] || null,
                        status: r['status'] || 'Open',
                        parentTradeId: r['parenttradeid'] ? Number(r['parenttradeid']) : null,
                    });
                }
            }

            // set preview and open editable modal (do not upload yet)
            // limit preview size to 250 rows to avoid huge previews
            setImportPreview(parsedTrades.slice(0, 250));
             setIsImportPreviewOpen(true);
         } catch (err) {
             console.error('Error parsing CSV:', err);
             setError('Failed to parse CSV. Please check the file format.');
             if (fileInputRef.current) fileInputRef.current.value = '';
         }
     };

     // Editable preview helpers
     const updateImportRow = (index, field, value) => {
        setImportPreview(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    };
    const removeImportRow = (index) => {
        setImportPreview(prev => prev.filter((_, i) => i !== index));
    };
    const addImportRow = () => {
        setImportPreview(prev => [...prev, {
            ticker: '',
            type: 'CSP',
            strike: 0,
            quantity: 1,
            delta: null,
            entryPrice: 0,
            closePrice: 0,
            openedDate: new Date().toISOString().split('T')[0],
            expirationDate: '',
            closedDate: null,
            status: 'Open',
            parentTradeId: null,
        }]);
    };

    const cancelImportPreview = () => {
        setIsImportPreviewOpen(false);
        setImportPreview([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmImport = async () => {
         if (!importPreview.length) {
             setError('Nothing to import');
             return;
         }
         try {
             const response = await fetch(`${API_URL}/trades/import`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ trades: importPreview }),
             });
             if (!response.ok) throw new Error('Failed to import trades');
             const result = await response.json();
             await fetchTrades();
             setIsImportPreviewOpen(false);
             setImportPreview([]);
             // reset file input and filename so user can re-use control
             if (fileInputRef.current) fileInputRef.current.value = '';
            setImportFileName('');
            setError(null);
         } catch (err) {
             console.error('Error importing trades:', err);
             setError('Failed to import trades. Please try again.');
         }
     };

    // --- Render ---
    return (
        <div className="p-4">
            <header className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold">Optionable</h1>
                <div className="flex items-center gap-2">
                    <select
                        value={importFormat}
                        onChange={(e) => setImportFormat(e.target.value)}
                        className="border px-2 py-1 rounded"
                    >
                        <option value="auto">Auto</option>
                        <option value="optionable">Optionable</option>
                        <option value="activity">Activity</option>
                    </select>
                    <button
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded"
                    >
                        <Upload size={16} /> Import
                    </button>
                    <button
                        onClick={() => setShowTrades(s => !s)}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-800 text-white rounded"
                        title="Show trades table"
                    >
                        <TrendingUp size={16} /> {showTrades ? 'Hide Trades' : 'Show Trades'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={importFromCSV}
                    />
                </div>
            </header>

            {error && <div className="text-red-600 mb-2">{error}</div>}

            <main>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-white border p-3 rounded">
                        <h3 className="text-sm font-semibold mb-2">Premium P&L by Open Date</h3>
                        {chartData.length ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" tickFormatter={formatDateShort} />
                                    <YAxis />
                                    <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l) => formatDate(l)} />
                                    <Area type="monotone" dataKey="pnl" stroke="#10b981" fill="url(#pnlGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-sm text-gray-500">No chart data yet</div>
                        )}
                    </div>
                </div>

                {showTrades && (
                    <div className="bg-white border p-3 rounded mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold">Trades</h3>
                            <div className="flex items-center gap-2">
                                <button className="px-2 py-1 bg-gray-100 rounded" onClick={() => setCurrentPage(1)}>First</button>
                                <button
                                    className="px-2 py-1 rounded bg-gray-100"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="px-2">Page {currentPage} / {totalPages || 1}</div>
                                <button
                                    className="px-2 py-1 rounded bg-gray-100"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight size={16} />
                                </button>
                                <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={exportToCSV}><Download size={14} /> Export</button>
                            </div>
                        </div>

                        <div className="overflow-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-2 text-left">ID</th>
                                        <th className="p-2 text-left">Ticker</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Strike</th>
                                        <th className="p-2">Qty</th>
                                        <th className="p-2">Entry</th>
                                        <th className="p-2">Close</th>
                                        <th className="p-2">Opened</th>
                                        <th className="p-2">Exp</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTrades.map((t, idx) => (
                                        <tr key={t.id ?? idx} className="odd:bg-white even:bg-gray-50">
                                            <td className="p-2 text-sm">{t.id}</td>
                                            <td className="p-2 text-sm">{t.ticker}</td>
                                            <td className="p-2 text-sm">{t.type}</td>
                                            <td className="p-2 text-sm">{t.strike}</td>
                                            <td className="p-2 text-sm">{t.quantity}</td>
                                            <td className="p-2 text-sm">{formatCurrency(Number(t.entryPrice) || 0)}</td>
                                            <td className="p-2 text-sm">{formatCurrency(Number(t.closePrice) || 0)}</td>
                                            <td className="p-2 text-sm">{formatDate(t.openedDate)}</td>
                                            <td className="p-2 text-sm">{formatDate(t.expirationDate)}</td>
                                            <td className="p-2 text-sm">{t.status}</td>
                                            <td className="p-2 text-sm flex items-center gap-2">
                                                <button title="Edit" className="p-1" onClick={() => openModal(t)}><Edit2 size={14} /></button>
                                                <button title="Duplicate" className="p-1" onClick={() => duplicateTrade(t)}><Copy size={14} /></button>
                                                <button title="Roll" className="p-1" onClick={() => rollTrade(t)}><Link2 size={14} /></button>
                                                <button title="Delete" className="p-1 text-red-600" onClick={() => deleteTrade(t.id)}><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {paginatedTrades.length === 0 && <div className="text-sm text-gray-500 p-2">No trades available</div>}
                    </div>
                )}
            </main>

            {isImportPreviewOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <div className="bg-white max-w-4xl w-full p-4 rounded">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-semibold">Import Preview ({importPreview.length})</h2>
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1 bg-gray-200 rounded" onClick={cancelImportPreview}>Cancel</button>
                                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={confirmImport}>Confirm Import</button>
                            </div>
                        </div>
                        <div className="overflow-auto max-h-96 border rounded">
                            <table className="min-w-full">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-2 text-left">Ticker</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Strike</th>
                                        <th className="p-2">Qty</th>
                                        <th className="p-2">Entry</th>
                                        <th className="p-2">Close</th>
                                        <th className="p-2">Opened</th>
                                        <th className="p-2">Exp</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreview.map((row, i) => (
                                        <tr key={i} className={row.status === 'Rolled' ? 'bg-yellow-50' : ''}>
                                            <td className="p-1"><input className="border rounded px-1" value={row.ticker || ''} onChange={(e) => updateImportRow(i, 'ticker', e.target.value)} /></td>
                                            <td className="p-1"><input className="border rounded px-1" value={row.type || ''} onChange={(e) => updateImportRow(i, 'type', e.target.value)} /></td>
                                            <td className="p-1"><input className="border rounded px-1" value={row.strike ?? ''} onChange={(e) => updateImportRow(i, 'strike', e.target.value)} /></td>
                                            <td className="p-1"><input className="border rounded px-1" value={row.quantity ?? ''} onChange={(e) => updateImportRow(i, 'quantity', e.target.value)} /></td>
                                            <td className="p-1"><input className="border rounded px-1" value={row.entryPrice ?? ''} onChange={(e) => updateImportRow(i, 'entryPrice', e.target.value)} /></td>
                                            <td className="p-1"><input className="border rounded px-1" value={row.closePrice ?? ''} onChange={(e) => updateImportRow(i, 'closePrice', e.target.value)} /></td>
                                            <td className="p-1"><input className="border rounded px-1" value={row.openedDate || ''} onChange={(e) => updateImportRow(i, 'openedDate', e.target.value)} /></td>
                                            <td className="p-1"><input className="border rounded px-1" value={row.expirationDate || ''} onChange={(e) => updateImportRow(i, 'expirationDate', e.target.value)} /></td>
                                            <td className="p-1">{row.status}</td>
                                            <td className="p-1"><button onClick={() => removeImportRow(i)} className="text-red-600"><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={addImportRow}><Plus size={14} /> Add row</button>
                            <div className="text-sm text-gray-500">Showing up to 250 rows</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

