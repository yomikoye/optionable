import React from 'react';
import { formatCurrency, formatPercent } from '../../utils/formatters';

const KpiCard = ({ label, value, subtext, valueClassName = '' }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[88px]">
        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</span>
        <div className={`text-2xl font-bold font-mono mt-1 ${valueClassName}`}>
            {value}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</div>
    </div>
);

export const Dashboard = ({ stats }) => {
    const totalPnLWithCapitalGains = stats.totalPnLWithCapitalGains ?? stats.totalPnL;
    const realizedCapitalGL = stats.realizedCapitalGL ?? 0;
    const closedPositions = stats.closedPositions ?? 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
                label="Premium Collected"
                value={formatCurrency(stats.totalPremiumCollected)}
                valueClassName="text-emerald-600 dark:text-emerald-400"
                subtext={`${stats.closedTradesCount} closed trades`}
            />

            <KpiCard
                label="Avg ROI"
                value={formatPercent(stats.avgRoi)}
                valueClassName={stats.avgRoi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                subtext={`${stats.closedTradesCount} closed trades`}
            />

            <KpiCard
                label="Win Rate"
                value={formatPercent(stats.winRate)}
                valueClassName="text-indigo-600 dark:text-indigo-400"
                subtext={`${stats.resolvedChains} closed chains`}
            />

            <KpiCard
                label="Stock Gains"
                value={formatCurrency(realizedCapitalGL)}
                valueClassName={realizedCapitalGL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                subtext={`${closedPositions} closed positions`}
            />

            <KpiCard
                label="Total P/L"
                value={formatCurrency(totalPnLWithCapitalGains)}
                valueClassName={totalPnLWithCapitalGains >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                subtext="Premiums + Stock Gains"
            />

            <KpiCard
                label="Deployed Capital"
                value={formatCurrency(stats.capitalAtRisk)}
                valueClassName="text-slate-700 dark:text-slate-200"
                subtext={`${stats.openTradesCount} open trade${stats.openTradesCount !== 1 ? 's' : ''}`}
            />
        </div>
    );
};
