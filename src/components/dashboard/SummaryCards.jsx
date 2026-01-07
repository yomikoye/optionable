import React from 'react';
import { formatCurrency } from '../../utils/formatters';

const StatTable = ({ title, data, emptyMessage, formatKey, sortFn }) => (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-semibold text-sm text-slate-700 dark:text-slate-200">
            {title}
        </div>
        <div className="overflow-y-auto max-h-48">
            {Object.keys(data).length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">{emptyMessage}</div>
            ) : (
                <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {Object.entries(data)
                            .sort(sortFn)
                            .map(([key, pnl]) => (
                                <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className={`px-4 py-2 text-sm ${formatKey ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {key}
                                    </td>
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
);

const TipsCard = () => (
    <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 p-4">
        <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-300 mb-3">Wheel Strategy Tips</h4>
        <ul className="text-sm space-y-2 text-indigo-700 dark:text-indigo-400 list-disc pl-4">
            <li>Sell CSPs on red days.</li>
            <li>Sell CCs on green days.</li>
            <li>Avoid earnings weeks if conservative.</li>
            <li>Don't wheel stocks you don't want to own!</li>
        </ul>
    </div>
);

export const SummaryCards = ({ stats }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTable
                title="Monthly P/L"
                data={stats.monthlyStats}
                emptyMessage="No data yet"
                sortFn={(a, b) => new Date(b[0]) - new Date(a[0])}
            />
            <StatTable
                title="Ticker P/L"
                data={stats.tickerStats}
                emptyMessage="No data yet"
                formatKey={true}
                sortFn={(a, b) => b[1] - a[1]}
            />
            <TipsCard />
        </div>
    );
};
