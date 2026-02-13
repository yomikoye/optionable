import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

const formatMonth = (month) => {
    const [year, m] = month.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${year.slice(2)}`;
};

const formatCurrency = (value) => {
    if (value === 0) return '$0';
    const sign = value >= 0 ? '' : '-';
    const abs = Math.abs(value);
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{formatMonth(label)}</p>
                {payload.map((p, i) => (
                    <p key={i} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                        <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
                        <span className={`font-mono font-medium ${p.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${Math.abs(p.value).toFixed(2)}
                        </span>
                    </p>
                ))}
                <div className="border-t border-slate-200 dark:border-slate-600 mt-1.5 pt-1.5">
                    <p className={`font-mono font-bold ${total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        Total: ${Math.abs(total).toFixed(2)}
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export const MonthlyPLChart = ({ data, darkMode }) => {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Monthly P/L Breakdown</h3>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis
                            dataKey="month"
                            tickFormatter={formatMonth}
                            tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                            tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: darkMode ? '#64748b' : '#94a3b8' }}
                            tickLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
                            tickFormatter={formatCurrency}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ fontSize: 12 }}
                            iconType="square"
                            iconSize={10}
                        />
                        <Bar dataKey="options" name="Options" stackId="pnl" fill="#6366f1" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="stocks" name="Stocks" stackId="pnl" fill="#a855f7" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="income" name="Income" stackId="pnl" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
