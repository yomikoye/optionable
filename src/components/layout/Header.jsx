import React from 'react';
import { Activity, Sun, Moon, Download, Upload, Plus, Wallet, Settings } from 'lucide-react';

export const Header = ({
    darkMode,
    onToggleTheme,
    onExport,
    onImport,
    onNewTrade,
    onOpenPositions,
    onOpenSettings
}) => {
    return (
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    Optionable
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Documenting the Wheel Strategy</p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-2">
                {/* Positions Button */}
                <button
                    onClick={onOpenPositions}
                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-medium transition-colors"
                    title="View stock positions"
                >
                    <Wallet className="w-4 h-4" />
                    <span className="hidden sm:inline">Positions</span>
                </button>

                {/* Settings Button */}
                <button
                    onClick={onOpenSettings}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    title="Settings"
                >
                    <Settings className="w-4 h-4" />
                </button>

                {/* Theme Toggle */}
                <button
                    onClick={onToggleTheme}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* Export Button */}
                <button
                    onClick={onExport}
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
                        onChange={onImport}
                        className="hidden"
                    />
                </label>

                {/* New Trade Button */}
                <button
                    onClick={onNewTrade}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Trade
                </button>
            </div>
        </header>
    );
};
