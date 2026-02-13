import React from 'react';
import { Landmark, TrendingUp, Percent, BarChart3, Coins, PieChart } from 'lucide-react';

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    const num = Number(value);
    const sign = num >= 0 ? '' : '-';
    return `${sign}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const KPICard = ({ label, value, icon: Icon, color, subtext, valueColor }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <p className={`text-2xl font-bold ${valueColor || 'text-slate-900 dark:text-white'}`}>
            {value}
        </p>
        {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
    </div>
);

const pnlColor = (val) => {
    const num = Number(val);
    if (num > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (num < 0) return 'text-red-600 dark:text-red-400';
    return 'text-slate-900 dark:text-white';
};

export const PortfolioDashboard = ({ stats }) => {
    if (!stats) return null;

    const income = (stats.dividends || 0) + (stats.interest || 0) - (stats.fees || 0);

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Portfolio</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KPICard
                    label="Deposited"
                    value={formatCurrency(stats.netDeposited)}
                    icon={Landmark}
                    color="text-slate-600 dark:text-slate-400"
                    subtext={stats.totalWithdrawals > 0 ? `${formatCurrency(stats.totalWithdrawals)} withdrawn` : undefined}
                />
                <KPICard
                    label="Total P/L"
                    value={formatCurrency(stats.totalPnL)}
                    icon={TrendingUp}
                    color="text-emerald-600 dark:text-emerald-400"
                    valueColor={pnlColor(stats.totalPnL)}
                    subtext="From closed positions"
                />
                <KPICard
                    label="Rate of Return"
                    value={`${(stats.rateOfReturn || 0).toFixed(1)}%`}
                    icon={Percent}
                    color="text-indigo-600 dark:text-indigo-400"
                    valueColor={pnlColor(stats.rateOfReturn)}
                    subtext="Based on realized P/L"
                />
                <KPICard
                    label="Options P/L"
                    value={formatCurrency(stats.optionsPnL)}
                    icon={BarChart3}
                    color="text-blue-600 dark:text-blue-400"
                    valueColor={pnlColor(stats.optionsPnL)}
                    subtext={`${stats.closedTradesCount || 0} closed trades`}
                />
                <KPICard
                    label="Stock Gains"
                    value={formatCurrency(stats.stockGains)}
                    icon={TrendingUp}
                    color="text-purple-600 dark:text-purple-400"
                    valueColor={pnlColor(stats.stockGains)}
                    subtext={`${stats.closedStockPositions || 0} closed positions`}
                />
                <KPICard
                    label="Income"
                    value={formatCurrency(income)}
                    icon={Coins}
                    color="text-amber-600 dark:text-amber-400"
                    subtext={[
                        stats.dividends > 0 ? `${formatCurrency(stats.dividends)} div` : null,
                        stats.interest > 0 ? `${formatCurrency(stats.interest)} int` : null,
                        stats.fees > 0 ? `${formatCurrency(stats.fees)} fees` : null,
                    ].filter(Boolean).join(' · ') || undefined}
                />
            </div>
        </div>
    );
};
