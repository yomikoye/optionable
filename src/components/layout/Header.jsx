import React from 'react';
import { Activity, Download, Upload, Plus, Settings, ChevronDown, TrendingUp } from 'lucide-react';

export const Header = ({
    onExport,
    onImport,
    onNewTrade,
    onOpenSettings,
    version,
    accounts,
    selectedAccountId,
    onAccountChange,
    newTradeLabel,
    newTradeIcon: NewTradeIcon
}) => {
    return (
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        Optionable
                        {version && (
                            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                v{version}
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Documenting the Wheel Strategy</p>
                </div>

                {/* Account Selector */}
                {accounts && accounts.length > 0 && (
                    <div className="relative">
                        <select
                            value={selectedAccountId ?? ''}
                            onChange={(e) => onAccountChange(e.target.value ? Number(e.target.value) : null)}
                            className="appearance-none bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 pl-3 pr-8 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Accounts</option>
                            {accounts.map(account => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                )}
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-2">
                {/* Settings Button */}
                <button
                    onClick={onOpenSettings}
                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-medium transition-colors"
                    title="Settings"
                >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Settings</span>
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

                {/* New Trade / Buy Stock Button */}
                <button
                    onClick={onNewTrade}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    {NewTradeIcon ? <NewTradeIcon className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {newTradeLabel || 'New Trade'}
                </button>
            </div>
        </header>
    );
};
