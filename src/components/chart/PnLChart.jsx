import React from 'react';
import { TrendingUp } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { formatCurrency, formatDate } from '../../utils/formatters';

const PERIODS = [
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All' }
];

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200">{data.ticker}</p>
                <p className="text-slate-500 dark:text-slate-400">{formatDate(data.fullDate)}</p>
                <p className={`font-mono font-medium ${data.tradePnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    Trade: {formatCurrency(data.tradePnl)}
                </p>
                <p className={`font-mono font-bold ${data.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    Total: {formatCurrency(data.pnl)}
                </p>
            </div>
        );
    }
    return null;
};

export const PnLChart = ({
    chartData,
    chartPeriod,
    onPeriodChange,
    totalPnL,
    darkMode
}) => {
    if (chartData.length === 0) return null;

    const chartColor = totalPnL >= 0 ? "#10b981" : "#ef4444";

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    Cumulative P/L
                </h3>
                <div className="flex items-center gap-3">
                    {/* Time Period Selector */}
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                        {PERIODS.map(period => (
                            <button
                                key={period.key}
                                onClick={() => onPeriodChange(period.key)}
                                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                    chartPeriod === period.key
                                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                    <span className={`text-sm font-mono font-bold ${totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(totalPnL)}
                    </span>
                </div>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                            tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                            tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="pnl"
                            stroke={chartColor}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPnl)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
