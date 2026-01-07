import React, { useState, useEffect } from 'react';
import { Settings, X, Wifi, WifiOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export const SettingsModal = ({ onClose, showToast }) => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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

    const livePricesEnabled = settings.live_prices_enabled === 'true';

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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
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
                <div className="p-4 space-y-4">
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
                                    Fetch real-time prices for unrealized G/L
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

                    {/* Info */}
                    <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">About Live Prices</p>
                        <p>When enabled, stock prices are fetched from stockprices.dev (free, no API key required). Prices are cached for offline use.</p>
                        <p className="mt-2">When disabled, only realized gains from closed positions are tracked.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
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
