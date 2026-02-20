import React, { useState, useMemo, useEffect } from 'react';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    X,
    Link2,
    Check,
    RefreshCw,
    Edit2,
    Trash2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    PlusCircle
} from 'lucide-react';
import { formatDateShort, formatCurrency, formatPercent } from '../../utils/formatters';
import { calculateDTE, calculateMetrics } from '../../utils/calculations';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' }
];

export const TradeTable = ({
    trades,
    filteredAndSortedTrades,
    statusFilter,
    setStatusFilter,
    sortConfig,
    setSortConfig,
    currentPage,
    setCurrentPage,
    tradesPerPage = 5,
    onQuickClose,
    onRoll,
    onEdit,
    onDelete,
    onOpenCC,
    confirmExpireEnabled = true,
    livePricesEnabled = false
}) => {
    const API_URL = '/api';
    const [expandedChains, setExpandedChains] = useState(new Set());
    const [expireConfirm, setExpireConfirm] = useState(null); // trade to confirm expire
    const [prices, setPrices] = useState({});

    useEffect(() => {
        if (!livePricesEnabled) { setPrices({}); return; }
        const tickers = [...new Set(trades.map(t => t.ticker.toUpperCase()))];
        if (tickers.length === 0) return;
        fetch(`${API_URL}/prices/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers })
        })
            .then(res => res.json())
            .then(data => { if (data.success) setPrices(data.data); })
            .catch(() => {});
    }, [livePricesEnabled, trades]);

    const handleExpireClick = (trade) => {
        if (confirmExpireEnabled) {
            setExpireConfirm(trade);
        } else {
            onQuickClose(trade);
        }
    };

    const confirmExpire = () => {
        if (expireConfirm) {
            onQuickClose(expireConfirm);
            setExpireConfirm(null);
        }
    };

    // Build chains from trades - group related trades together
    const chainedTrades = useMemo(() => {
        // Pre-compute metrics for all trades once (avoid recalculating in loops)
        const metricsCache = new Map();
        for (const trade of filteredAndSortedTrades) {
            metricsCache.set(trade.id, calculateMetrics(trade));
        }

        // Build lookup Map: parentTradeId -> child trade (O(1) lookup vs O(n) find)
        const childByParent = new Map();
        for (const trade of filteredAndSortedTrades) {
            if (trade.parentTradeId) {
                childByParent.set(trade.parentTradeId, trade);
            }
        }

        // Find all chain roots (trades without parent)
        const roots = filteredAndSortedTrades.filter(t => !t.parentTradeId);

        // Build chain for each root
        const chains = [];
        const processedIds = new Set();

        for (const root of roots) {
            if (processedIds.has(root.id)) continue;

            const chain = [root];
            processedIds.add(root.id);

            // Follow the chain forward using Map lookup (O(1) per step)
            let currentId = root.id;
            let child = childByParent.get(currentId);
            while (child && !processedIds.has(child.id)) {
                chain.push(child);
                processedIds.add(child.id);
                currentId = child.id;
                child = childByParent.get(currentId);
            }

            // Calculate chain totals using pre-computed metrics
            let chainPnL = 0;
            let chainCollateral = 0;
            for (const t of chain) {
                const m = metricsCache.get(t.id);
                chainPnL += m.pnl;
                chainCollateral += m.collateral;
            }
            const chainRoi = chainCollateral > 0 ? (chainPnL / chainCollateral) * 100 : 0;
            const lastTrade = chain[chain.length - 1];

            chains.push({
                id: root.id,
                root,
                trades: chain,
                chainPnL,
                chainRoi,
                isMultiTrade: chain.length > 1,
                finalStatus: lastTrade.status
            });
        }

        // Add any orphaned trades (shouldn't happen normally)
        for (const trade of filteredAndSortedTrades) {
            if (!processedIds.has(trade.id)) {
                const m = metricsCache.get(trade.id);
                chains.push({
                    id: trade.id,
                    root: trade,
                    trades: [trade],
                    chainPnL: m.pnl,
                    chainRoi: m.roi,
                    isMultiTrade: false,
                    finalStatus: trade.status
                });
            }
        }

        // Sort chains: use user's sort selection, or default to newest first
        if (sortConfig.key) {
            chains.sort((a, b) => {
                let aVal, bVal;
                const aLast = a.trades[a.trades.length - 1];
                const bLast = b.trades[b.trades.length - 1];
                if (sortConfig.key === 'pnl') {
                    aVal = a.chainPnL;
                    bVal = b.chainPnL;
                } else if (sortConfig.key === 'roi') {
                    aVal = a.chainRoi;
                    bVal = b.chainRoi;
                } else if (sortConfig.key === 'ticker') {
                    aVal = a.root.ticker.toLowerCase();
                    bVal = b.root.ticker.toLowerCase();
                } else if (sortConfig.key === 'openedDate' || sortConfig.key === 'expirationDate') {
                    aVal = new Date(a.root[sortConfig.key]);
                    bVal = new Date(b.root[sortConfig.key]);
                } else if (sortConfig.key === 'status') {
                    aVal = a.finalStatus;
                    bVal = b.finalStatus;
                } else if (sortConfig.key === 'dte') {
                    aVal = calculateDTE(aLast.expirationDate, aLast.status) ?? -1;
                    bVal = calculateDTE(bLast.expirationDate, bLast.status) ?? -1;
                } else if (sortConfig.key === 'delta') {
                    aVal = a.root.delta ?? -1;
                    bVal = b.root.delta ?? -1;
                } else {
                    aVal = a.root[sortConfig.key];
                    bVal = b.root[sortConfig.key];
                }
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            chains.sort((a, b) => new Date(b.root.openedDate) - new Date(a.root.openedDate));
        }

        return chains;
    }, [filteredAndSortedTrades, sortConfig]);

    // Paginate chains
    const showAll = tradesPerPage === null;
    const totalChainPages = showAll ? 1 : Math.ceil(chainedTrades.length / tradesPerPage);
    const paginatedChains = showAll ? chainedTrades
        : chainedTrades.slice((currentPage - 1) * tradesPerPage, currentPage * tradesPerPage);

    const toggleChain = (chainId) => {
        setExpandedChains(prev => {
            const next = new Set(prev);
            if (next.has(chainId)) {
                next.delete(chainId);
            } else {
                next.add(chainId);
            }
            return next;
        });
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3" />
            : <ArrowDown className="w-3 h-3" />;
    };

    const clearFilters = () => {
        setStatusFilter('all');
        setSortConfig({ key: null, direction: 'desc' });
        setCurrentPage(1);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Trade Log
                </h3>
                <div className="flex items-center gap-3">
                    {/* Status Filter Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                        {STATUS_TABS.map(tab => (
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
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                        >
                            <X className="w-3 h-3" />
                            Clear
                        </button>
                    )}
                    <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {chainedTrades.length} chains · {filteredAndSortedTrades.length} trades
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left [&_th]:border-r [&_th]:border-slate-200 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-100 [&_td:last-child]:border-r-0 dark:[&_th]:border-slate-600 dark:[&_td]:border-slate-700">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-3 py-2 w-[12%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('ticker')}>
                                <span className="inline-flex items-center gap-1 justify-center"><span className="p-0.5"><ChevronRight className="w-4 h-4 text-transparent" /></span>Ticker {getSortIcon('ticker')}</span>
                            </th>
                            <th className="px-3 py-2 w-[5%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('type')}>
                                <span className="inline-flex items-center gap-1 justify-center">Type {getSortIcon('type')}</span>
                            </th>
                            <th className="px-3 py-2 w-[7%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('strike')}>
                                <span className="inline-flex items-center gap-1 justify-center">Strike {getSortIcon('strike')}</span>
                            </th>
                            {livePricesEnabled && <th className="px-3 py-2 w-[7%] font-semibold text-center">Price</th>}
                            <th className="px-3 py-2 w-[5%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('quantity')}>
                                <span className="inline-flex items-center gap-1 justify-center">Qty {getSortIcon('quantity')}</span>
                            </th>
                            <th className="px-3 py-2 w-[6%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('delta')}>
                                <span className="inline-flex items-center gap-1 justify-center">Delta {getSortIcon('delta')}</span>
                            </th>
                            <th className="px-3 py-2 w-[8%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('openedDate')}>
                                <span className="inline-flex items-center gap-1 justify-center">Opened {getSortIcon('openedDate')}</span>
                            </th>
                            <th className="px-3 py-2 w-[8%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('expirationDate')}>
                                <span className="inline-flex items-center gap-1 justify-center">Expiry {getSortIcon('expirationDate')}</span>
                            </th>
                            <th className="px-3 py-2 w-[5%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('dte')}>
                                <span className="inline-flex items-center gap-1 justify-center">DTE {getSortIcon('dte')}</span>
                            </th>
                            <th className="px-3 py-2 w-[9%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('pnl')}>
                                <span className="inline-flex items-center gap-1 justify-center">P/L {getSortIcon('pnl')}</span>
                            </th>
                            <th className="px-3 py-2 w-[7%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('roi')}>
                                <span className="inline-flex items-center gap-1 justify-center">ROI {getSortIcon('roi')}</span>
                            </th>
                            <th className="px-3 py-2 w-[8%] font-semibold text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('status')}>
                                <span className="inline-flex items-center gap-1 justify-center">Status {getSortIcon('status')}</span>
                            </th>
                            <th className="px-3 py-2 w-[13%] font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {paginatedChains.length === 0 ? (
                            <tr>
                                <td colSpan={livePricesEnabled ? 13 : 12} className="px-4 py-12 text-center text-sm text-slate-400">
                                    {trades.length === 0 ? "No trades yet. Click \"New Trade\" to start your wheel." : "No trades match the current filter."}
                                </td>
                            </tr>
                        ) : (
                            paginatedChains.map((chain) => {
                                const isExpanded = expandedChains.has(chain.id);
                                const rootTrade = chain.root;
                                const lastTrade = chain.trades[chain.trades.length - 1];
                                const chainDte = calculateDTE(lastTrade.expirationDate, lastTrade.status);

                                return (
                                    <React.Fragment key={chain.id}>
                                        {/* Root/Main Trade Row */}
                                        <tr className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors ${chain.isMultiTrade ? 'bg-slate-25 dark:bg-slate-800/80' : ''}`}>
                                            <td className="px-3 py-2 text-center text-sm text-slate-700 dark:text-slate-200">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => chain.isMultiTrade && toggleChain(chain.id)}
                                                        className={`p-0.5 rounded ${chain.isMultiTrade ? 'hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer' : 'cursor-default'}`}
                                                        disabled={!chain.isMultiTrade}
                                                    >
                                                        {chain.isMultiTrade ? (
                                                            isExpanded ? (
                                                                <ChevronDown className="w-4 h-4 text-slate-500" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-slate-500" />
                                                            )
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-transparent" />
                                                        )}
                                                    </button>
                                                    <span className="font-medium">{rootTrade.ticker.toUpperCase()}</span>
                                                    {chain.isMultiTrade && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                                                            {chain.trades.length}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${rootTrade.type === 'CSP'
                                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                                                    : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400'
                                                }`}>
                                                    {rootTrade.type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono text-sm text-slate-600 dark:text-slate-300">${rootTrade.strike}</td>
                                            {livePricesEnabled && (() => {
                                                const price = prices[rootTrade.ticker.toUpperCase()]?.price;
                                                return (
                                                    <td className={`px-3 py-2 text-center font-mono text-sm font-medium ${
                                                        price != null
                                                            ? price >= rootTrade.strike
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-red-500 dark:text-red-400'
                                                            : 'text-slate-400'
                                                    }`}>
                                                        {price != null ? `$${price.toFixed(2)}` : '—'}
                                                    </td>
                                                );
                                            })()}
                                            <td className="px-3 py-2 text-center font-mono text-sm text-slate-600 dark:text-slate-300">{rootTrade.quantity}</td>
                                            <td className="px-3 py-2 text-center font-mono text-sm text-slate-500 dark:text-slate-400">
                                                {rootTrade.delta ? rootTrade.delta.toFixed(2) : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-center text-sm text-slate-500 dark:text-slate-400">
                                                {formatDateShort(rootTrade.openedDate)}
                                            </td>
                                            <td className="px-3 py-2 text-center text-sm text-slate-500 dark:text-slate-400">
                                                {(lastTrade.status === 'Closed' || lastTrade.status === 'Rolled') && lastTrade.closedDate
                                                    ? formatDateShort(lastTrade.closedDate)
                                                    : formatDateShort(lastTrade.expirationDate)
                                                }
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {chainDte !== null ? (
                                                    <span className={`font-mono text-sm font-medium ${chainDte <= 3 ? 'text-red-600 dark:text-red-400' :
                                                        chainDte <= 7 ? 'text-orange-600 dark:text-orange-400' :
                                                            'text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                        {chainDte}d
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                                                )}
                                            </td>
                                            <td className={`px-3 py-2 text-center font-mono text-sm font-medium ${chain.chainPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                {formatCurrency(chain.chainPnL)}
                                                {chain.isMultiTrade && (
                                                    <span className="block text-[10px] text-slate-400 font-normal">chain total</span>
                                                )}
                                            </td>
                                            <td className={`px-3 py-2 text-center font-mono text-sm ${chain.chainRoi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                {formatPercent(chain.chainRoi)}
                                            </td>
                                            <td className={`px-3 py-2 text-center text-xs font-medium ${
                                                chain.finalStatus === 'Open' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                                            }`}>
                                                {chain.finalStatus}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {/* Open CC button - shown when CSP was assigned and shares still owned (no open CC, and last CC wasn't assigned) */}
                                                    {rootTrade.type === 'CSP' &&
                                                     rootTrade.status === 'Assigned' &&
                                                     chain.finalStatus !== 'Open' &&
                                                     !(chain.trades[chain.trades.length - 1].type === 'CC' && chain.trades[chain.trades.length - 1].status === 'Assigned') &&
                                                     onOpenCC && (
                                                        <button
                                                            onClick={() => onOpenCC(chain.trades[chain.trades.length - 1])}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                                                            title="Sell a call on your assigned shares"
                                                        >
                                                            <PlusCircle className="w-3.5 h-3.5" />
                                                            <span>Sell CC</span>
                                                        </button>
                                                    )}
                                                    {chain.finalStatus === 'Open' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleExpireClick(chain.trades[chain.trades.length - 1])}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
                                                                title="Mark as expired worthless"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Expire</span>
                                                            </button>
                                                            <button
                                                                onClick={() => onRoll(chain.trades[chain.trades.length - 1])}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
                                                                title="Close and open new position"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5" />
                                                                <span>Roll</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => onEdit(rootTrade)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                                                        title="Modify trade details"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(rootTrade.id)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                                        title="Remove this trade"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Child Trade Rows (when expanded) */}
                                        {isExpanded && chain.trades.slice(1).map((trade, idx) => {
                                            const metrics = calculateMetrics(trade);
                                            const dte = calculateDTE(trade.expirationDate, trade.status);
                                            return (
                                                <tr key={trade.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-3 py-2 text-center text-sm text-slate-600 dark:text-slate-300">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <span className="text-slate-300 dark:text-slate-600 mr-1">└</span>
                                                            <Link2 className="w-3 h-3 text-amber-500" />
                                                            <span className="text-slate-500">Roll #{idx + 1}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${trade.type === 'CSP'
                                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                                                            : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400'
                                                        }`}>
                                                            {trade.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-mono text-sm text-slate-600 dark:text-slate-300">${trade.strike}</td>
                                                    {livePricesEnabled && (() => {
                                                        const price = prices[trade.ticker.toUpperCase()]?.price;
                                                        return (
                                                            <td className={`px-3 py-2 text-center font-mono text-sm font-medium ${
                                                                price != null
                                                                    ? price >= trade.strike
                                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                                        : 'text-red-500 dark:text-red-400'
                                                                    : 'text-slate-400'
                                                            }`}>
                                                                {price != null ? `$${price.toFixed(2)}` : '—'}
                                                            </td>
                                                        );
                                                    })()}
                                                    <td className="px-3 py-2 text-center font-mono text-sm text-slate-600 dark:text-slate-300">{trade.quantity}</td>
                                                    <td className="px-3 py-2 text-center font-mono text-sm text-slate-500 dark:text-slate-400">
                                                        {trade.delta ? trade.delta.toFixed(2) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-sm text-slate-500 dark:text-slate-400">
                                                        {formatDateShort(trade.openedDate)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-sm text-slate-500 dark:text-slate-400">
                                                        {(trade.status === 'Closed' || trade.status === 'Rolled') && trade.closedDate
                                                            ? formatDateShort(trade.closedDate)
                                                            : formatDateShort(trade.expirationDate)
                                                        }
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {dte !== null ? (
                                                            <span className={`font-mono text-sm font-medium ${dte <= 3 ? 'text-red-600 dark:text-red-400' : dte <= 7 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                                                {dte}d
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-3 py-2 text-center font-mono text-sm font-medium ${metrics.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                        {formatCurrency(metrics.pnl)}
                                                    </td>
                                                    <td className={`px-3 py-2 text-center font-mono text-sm ${metrics.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                        {formatPercent(metrics.roi)}
                                                    </td>
                                                    <td className={`px-3 py-2 text-center text-xs font-medium ${
                                                        trade.status === 'Open' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        {trade.status}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <button
                                                                onClick={() => onEdit(trade)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                                                                title="Edit trade"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                <span>Edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => onDelete(trade.id)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                                                title="Delete trade"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span>Delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalChainPages > 1 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Showing {((currentPage - 1) * tradesPerPage) + 1} - {Math.min(currentPage * tradesPerPage, chainedTrades.length)} of {chainedTrades.length} chains
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
                            {Array.from({ length: totalChainPages }, (_, i) => i + 1).map(page => (
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
                            onClick={() => setCurrentPage(p => Math.min(totalChainPages, p + 1))}
                            disabled={currentPage === totalChainPages}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Expire Confirmation Modal */}
            {expireConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            Confirm Expiry
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Mark <span className="font-semibold">{expireConfirm.ticker} {expireConfirm.type} ${expireConfirm.strike}</span> as expired worthless?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setExpireConfirm(null)}
                                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmExpire}
                                className="flex-1 px-4 py-2 bg-emerald-600 dark:bg-emerald-500 rounded-lg text-white font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-600"
                            >
                                Expire
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
