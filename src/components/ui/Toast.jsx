import React from 'react';
import { Check, X } from 'lucide-react';

export const Toast = ({ toast, onClose }) => {
    if (!toast) return null;

    const getTypeClasses = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-emerald-50 dark:bg-emerald-900/90 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300';
            case 'error':
                return 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
            default:
                return 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
        }
    };

    return (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2 animate-in slide-in-from-bottom-2 ${getTypeClasses()}`}>
            {toast.type === 'success' && <Check className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
