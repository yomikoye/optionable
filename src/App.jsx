import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';

// Shared utilities
import { APP_VERSION } from './utils/constants';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useTrades } from './hooks/useTrades';
import { useStats } from './hooks/useStats';
import { useFilterSort } from './hooks/useFilterSort';
import { useTradeForm } from './hooks/useTradeForm';
import { useCSV } from './hooks/useCSV';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Components
import {
    Toast,
    WelcomeModal,
    Header,
    Dashboard,
    PnLChart,
    TradeTable,
    TradeModal,
    SummaryCards,
    PositionsTable,
    SettingsModal
} from './components';

import { API_URL } from './utils/constants';

// --- Main Component ---
export default function App() {
    // Core data hooks
    const { trades, loading, error, setError, fetchTrades } = useTrades();
    const { darkMode, setDarkMode } = useTheme();
    const { stats, chainInfo, chartData, chartPeriod, setChartPeriod, fetchCapitalGainsStats } = useStats(trades);

    // Compose refreshAll at App level
    const refreshAll = useCallback(async () => {
        await fetchTrades();
        await fetchCapitalGainsStats();
    }, [fetchTrades, fetchCapitalGainsStats]);

    // Toast state
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Filter & sort
    const {
        statusFilter, setStatusFilter,
        sortConfig, setSortConfig,
        currentPage, setCurrentPage,
        filteredAndSortedTrades
    } = useFilterSort(trades);

    // Trade form (modal, CRUD)
    const tradeForm = useTradeForm({ refreshAll, showToast, setError, setCurrentPage });

    // CSV import/export
    const { exportToCSV, importFromCSV } = useCSV({ trades, refreshAll, showToast, setError });

    // Panel visibility
    const [showPositions, setShowPositions] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // App settings
    const [appSettings, setAppSettings] = useState({
        confirm_expire_enabled: 'true'
    });

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
        fetchSettings();
    }, []);

    // Keyboard shortcuts
    const anyModalOpen = tradeForm.isModalOpen || showPositions || showSettings || showHelp;

    const handleEscape = useCallback(() => {
        if (tradeForm.isModalOpen) tradeForm.closeModal();
        if (showPositions) setShowPositions(false);
        if (showSettings) setShowSettings(false);
        if (showHelp) setShowHelp(false);
    }, [tradeForm.isModalOpen, showPositions, showSettings, showHelp, tradeForm.closeModal]);

    const keyMap = useMemo(() => ({
        n: () => tradeForm.openModal(),
        p: () => setShowPositions(true),
        s: () => setShowSettings(true),
        d: () => setDarkMode(prev => !prev),
        h: () => setShowHelp(true),
    }), [tradeForm.openModal, setDarkMode]);

    useKeyboardShortcuts({ onEscape: handleEscape, isModalOpen: anyModalOpen, keyMap });

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
                    onNewTrade={() => tradeForm.openModal()}
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
                    onQuickClose={tradeForm.quickCloseTrade}
                    onRoll={tradeForm.rollTrade}
                    onEdit={tradeForm.openModal}
                    onDelete={tradeForm.deleteTrade}
                    onOpenCC={tradeForm.openCoveredCall}
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

            {/* Trade Modal */}
            <TradeModal
                isModalOpen={tradeForm.isModalOpen}
                formData={tradeForm.formData}
                setFormData={tradeForm.setFormData}
                editingId={tradeForm.editingId}
                isRolling={tradeForm.isRolling}
                rollFromTrade={tradeForm.rollFromTrade}
                rollClosePrice={tradeForm.rollClosePrice}
                setRollClosePrice={tradeForm.setRollClosePrice}
                handleInputChange={tradeForm.handleInputChange}
                closeModal={tradeForm.closeModal}
                saveTrade={tradeForm.saveTrade}
            />

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
