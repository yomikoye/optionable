import React from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip
} from 'recharts';

const COLORS = {
    options: '#6366f1',
    stocks: '#a855f7',
    income: '#f59e0b'
};

const LABELS = {
    options: 'Options P/L',
    stocks: 'Stock Gains',
    income: 'Income'
};

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    const num = Number(value);
    const sign = num >= 0 ? '' : '-';
    return `${sign}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const { name, value, payload: data } = payload[0];
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200">{name}</p>
                <p className={`font-mono font-medium ${value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(data.rawValue)}
                </p>
                <p className="text-slate-400 text-xs">{data.pctOfTotal.toFixed(1)}% of total</p>
            </div>
        );
    }
    return null;
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export const IncomeSourcesChart = ({ stats }) => {
    if (!stats) return null;

    const sources = [
        { key: 'options', rawValue: stats.optionsPnL || 0 },
        { key: 'stocks', rawValue: stats.stockGains || 0 },
        { key: 'income', rawValue: (stats.dividends || 0) + (stats.interest || 0) - (stats.fees || 0) }
    ];

    // Only show sources with positive values in the pie
    const positiveSources = sources.filter(s => s.rawValue > 0);
    const total = positiveSources.reduce((sum, s) => sum + s.rawValue, 0);

    if (total === 0) return null;

    const chartData = positiveSources.map(s => ({
        name: LABELS[s.key],
        value: s.rawValue,
        rawValue: s.rawValue,
        pctOfTotal: (s.rawValue / total) * 100,
        color: COLORS[s.key]
    }));

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
                <PieIcon className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Income Sources</h3>
            </div>
            <div className="flex items-center gap-6">
                <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                labelLine={false}
                                label={renderCustomLabel}
                            >
                                {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-3 flex-1">
                    {sources.map(s => (
                        <div key={s.key} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[s.key] }} />
                                <span className="text-sm text-slate-600 dark:text-slate-300">{LABELS[s.key]}</span>
                            </div>
                            <span className={`text-sm font-mono font-medium ${s.rawValue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(s.rawValue)}
                            </span>
                        </div>
                    ))}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Total</span>
                            <span className={`text-sm font-mono font-bold ${stats.totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(stats.totalPnL)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
