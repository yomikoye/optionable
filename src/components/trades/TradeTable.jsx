import React from 'react';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    X,
    Link2,
    Check,
    RefreshCw,
    Copy,
    Edit2,
    Trash2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { formatDateShort, formatCurrency, formatPercent } from '../../utils/formatters';
import { calculateDTE, calculateMetrics } from '../../utils/calculations';
import { TRADES_PER_PAGE } from '../../utils/constants';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' }
];

export const TradeTable = ({
    trades,
    filteredAndSortedTrades,
    paginatedTrades,
    chainInfo,
    statusFilter,
    setStatusFilter,
    sortConfig,
    setSortConfig,
    currentPage,
    setCurrentPage,
    totalPages,
    onQuickClose,
    onRoll,
    onDuplicate,
    onEdit,
    onDelete
}) => {
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
                        {filteredAndSortedTrades.length} trades
                    </span>
                </div>
            </div>

            {/* Table */}
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
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                trade.status === 'Open' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20' :
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
                                                            onClick={() => onQuickClose(trade)}
                                                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                                                            title="Close at $0 (expired)"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => onRoll(trade)}
                                                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded"
                                                            title="Roll trade"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => onDuplicate(trade)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                                    title="Duplicate trade"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onEdit(trade)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                                    title="Edit trade"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(trade.id)}
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
    );
};
