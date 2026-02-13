import React from 'react';
import { TrendingUp, Briefcase } from 'lucide-react';

export const TabBar = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'options', label: 'Options', icon: TrendingUp },
        { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    ];

    return (
        <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};
