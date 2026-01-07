import React from 'react';
import { formatCurrency, formatPercent } from '../../utils/formatters';

const KpiCard = ({ label, value, subtext, valueClassName = '' }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</span>
        <div className={`text-2xl font-bold mt-1 ${valueClassName}`}>
            {value}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</div>
    </div>
);

export const Dashboard = ({ stats }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
                label="Total P/L"
                value={formatCurrency(stats.totalPnL)}
                valueClassName={stats.totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                subtext={`${stats.completedTradesCount} closed`}
            />

            <KpiCard
                label="Premium"
                value={formatCurrency(stats.totalPremiumCollected)}
                valueClassName="text-emerald-600 dark:text-emerald-400"
                subtext="Total collected"
            />

            <KpiCard
                label="Win Rate"
                value={formatPercent(stats.winRate)}
                valueClassName="text-indigo-600 dark:text-indigo-400"
                subtext={`${stats.resolvedChains} chains`}
            />

            <KpiCard
                label="Avg ROI"
                value={formatPercent(stats.avgRoi)}
                valueClassName={stats.avgRoi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                subtext="Per trade"
            />

            <KpiCard
                label="Capital"
                value={formatCurrency(stats.capitalAtRisk)}
                valueClassName="text-slate-700 dark:text-slate-200"
                subtext={`${stats.openTradesCount} open`}
            />

            <KpiCard
                label="Best Ticker"
                value={stats.bestTicker ? stats.bestTicker.ticker : '—'}
                valueClassName="text-indigo-600 dark:text-indigo-400"
                subtext={stats.bestTicker ? formatCurrency(stats.bestTicker.pnl) : 'No data'}
            />
        </div>
    );
};
