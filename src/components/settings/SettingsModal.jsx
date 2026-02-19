import React, { useState, useEffect } from 'react';
import { Settings, X, Wifi, WifiOff, ShieldCheck, ShieldOff, Briefcase, BriefcaseIcon, Sun, Moon, Plus, Pencil, Trash2, Check, HelpCircle, List } from 'lucide-react';

const WELCOME_STORAGE_KEY = 'optionable_welcome_dismissed';

const API_URL = import.meta.env.VITE_API_URL || '';

export const SettingsModal = ({ onClose, showToast, accounts, onCreateAccount, onRenameAccount, onDeleteAccount, onAccountsChanged, darkMode, onToggleTheme }) => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [editingAccountId, setEditingAccountId] = useState(null);
    const [editingAccountName, setEditingAccountName] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_URL}/api/settings`);
            const data = await res.json();
            if (data.success) {
                setSettings(data.data);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            showToast?.('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key, value) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/settings/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
            const data = await res.json();
            if (data.success) {
                setSettings(prev => ({ ...prev, [key]: value }));
                showToast?.('Setting updated', 'success');
            }
        } catch (error) {
            console.error('Error updating setting:', error);
            showToast?.('Failed to update setting', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddAccount = async () => {
        if (!newAccountName.trim()) return;
        try {
            await onCreateAccount(newAccountName.trim());
            setNewAccountName('');
            showToast?.('Account created', 'success');
        } catch (err) {
            showToast?.('Failed to create account', 'error');
        }
    };

    const handleRenameAccount = async (id) => {
        if (!editingAccountName.trim()) return;
        try {
            await onRenameAccount(id, editingAccountName.trim());
            setEditingAccountId(null);
            setEditingAccountName('');
            showToast?.('Account renamed', 'success');
        } catch (err) {
            showToast?.('Failed to rename account', 'error');
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account? This will only work if the account has no data.')) return;
        try {
            await onDeleteAccount(id);
            showToast?.('Account deleted', 'success');
        } catch (err) {
            const msg = err.message || 'Cannot delete account with existing data';
            showToast?.(msg, 'error');
        }
    };

    const [showHelpOnStartup, setShowHelpOnStartup] = useState(() => {
        return !localStorage.getItem(WELCOME_STORAGE_KEY);
    });

    const toggleHelpOnStartup = () => {
        if (showHelpOnStartup) {
            localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
            setShowHelpOnStartup(false);
        } else {
            localStorage.removeItem(WELCOME_STORAGE_KEY);
            setShowHelpOnStartup(true);
        }
    };

    const livePricesEnabled = settings.live_prices_enabled === 'true';
    const confirmExpireEnabled = settings.confirm_expire_enabled !== 'false'; // Default true
    const portfolioModeEnabled = settings.portfolio_mode_enabled === 'true';
    const paginationEnabled = settings.pagination_enabled !== 'false';
    const [tradesPerPageInput, setTradesPerPageInput] = useState(settings.trades_per_page || '5');

    useEffect(() => {
        setTradesPerPageInput(settings.trades_per_page || '5');
    }, [settings.trades_per_page]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-8">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Settings List */}
                <div className="p-4 space-y-4 overflow-y-auto">
                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {darkMode ? (
                                <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                                <Sun className="w-5 h-5 text-amber-500" />
                            )}
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Dark Mode</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {darkMode ? 'Dark theme active' : 'Light theme active'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onToggleTheme}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                darkMode
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    darkMode ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Live Stock Prices Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {livePricesEnabled ? (
                                <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                                <WifiOff className="w-5 h-5 text-slate-400" />
                            )}
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Live Stock Prices</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Fetch real time price
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('live_prices_enabled', livePricesEnabled ? 'false' : 'true')}
                            disabled={saving}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                livePricesEnabled
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    livePricesEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Confirm Expire Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {confirmExpireEnabled ? (
                                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                                <ShieldOff className="w-5 h-5 text-slate-400" />
                            )}
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Confirm Expiry</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Ask for confirmation before expiring trades
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('confirm_expire_enabled', confirmExpireEnabled ? 'false' : 'true')}
                            disabled={saving}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                confirmExpireEnabled
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    confirmExpireEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Portfolio Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {portfolioModeEnabled ? (
                                <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                                <BriefcaseIcon className="w-5 h-5 text-slate-400" />
                            )}
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Portfolio Mode</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Track cash flow, stocks, and portfolio performance
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('portfolio_mode_enabled', portfolioModeEnabled ? 'false' : 'true')}
                            disabled={saving}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                portfolioModeEnabled
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    portfolioModeEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Paginate Trades Toggle */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <List className={`w-5 h-5 ${paginationEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">Paginate Trades</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Split trade log into pages
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('pagination_enabled', paginationEnabled ? 'false' : 'true')}
                                disabled={saving}
                                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                    paginationEnabled
                                        ? 'bg-indigo-500'
                                        : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                        paginationEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                        {paginationEnabled && (
                            <div className="px-4 pb-4 pt-0">
                                <div className="flex items-center gap-3 pl-8">
                                    <label className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">Trades per page</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={tradesPerPageInput}
                                        onChange={(e) => setTradesPerPageInput(e.target.value)}
                                        onBlur={() => {
                                            const val = Math.max(1, Math.min(100, parseInt(tradesPerPageInput) || 5));
                                            setTradesPerPageInput(String(val));
                                            updateSetting('trades_per_page', String(val));
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                        className="w-20 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Show Help on Startup Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <HelpCircle className={`w-5 h-5 ${showHelpOnStartup ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Show Help on Startup</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Display welcome guide when the app opens
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleHelpOnStartup}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                showHelpOnStartup
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    showHelpOnStartup ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Accounts Management */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <p className="font-medium text-slate-900 dark:text-white mb-3">Accounts</p>
                        <div className="space-y-2">
                            {accounts && accounts.map(account => (
                                <div key={account.id} className="flex items-center gap-2">
                                    {editingAccountId === account.id ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editingAccountName}
                                                onChange={(e) => setEditingAccountName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleRenameAccount(account.id)}
                                                className="flex-1 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleRenameAccount(account.id)}
                                                className="p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { setEditingAccountId(null); setEditingAccountName(''); }}
                                                className="p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{account.name}</span>
                                            <button
                                                onClick={() => { setEditingAccountId(account.id); setEditingAccountName(account.name); }}
                                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                                                title="Rename"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAccount(account.id)}
                                                className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <input
                                type="text"
                                value={newAccountName}
                                onChange={(e) => setNewAccountName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                                placeholder="New account name"
                                className="flex-1 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={handleAddAccount}
                                disabled={!newAccountName.trim()}
                                className="flex items-center gap-1 px-2 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">About Live Prices</p>
                        <p>When enabled, stock prices are fetched from stockprices.dev (free, no API key required). Prices are cached for offline use.</p>
                        <p className="mt-2">When disabled, only realized gains from closed positions are tracked.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
