import React, { useState, useEffect } from 'react';
import { X, Keyboard, TrendingUp, RefreshCw, PlusCircle, FileText, ArrowDown, ArrowRight, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'optionable_welcome_dismissed';

export const WelcomeModal = ({ isOpen: externalOpen, onClose }) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    // Show on first visit if not dismissed
    useEffect(() => {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (!dismissed) {
            setInternalOpen(true);
        }
    }, []);

    // Modal is open if either internal (first visit) or external (H key) triggers it
    const isOpen = internalOpen || externalOpen;

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem(STORAGE_KEY, 'true');
        }
        setInternalOpen(false);
        if (onClose) onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Welcome to Optionable</h2>
                            <p className="text-indigo-100 text-sm mt-1">Your wheel strategy tracker</p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 overflow-y-auto">
                    {/* How It Works */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                            How the Wheel Works
                        </h3>
                        <div className="space-y-2">
                            <Step number="1" title="Sell a Cash-Secured Put (CSP)" description="Collect premium on a stock you'd like to own at a lower price" />
                            <StepArrow />
                            <Step number="2" title="If assigned, you get the shares" description="Your position shows up automatically in the Stock Positions table" />
                            <StepArrow />
                            <Step number="3" title="Sell Covered Calls (CC) on those shares" description="Use the CC button on your position to start collecting more premium" />
                            <StepArrow />
                            <Step number="4" title="Repeat until shares are called away" description="Roll trades forward or let them expire — all linked in a chain" />
                        </div>
                    </div>

                    {/* Features */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                            Key Features
                        </h3>
                        <div className="space-y-3">
                            <Feature
                                icon={<PlusCircle className="w-4 h-4" />}
                                title="Track CSP & CC Trades"
                                description="Log trades with strike, premium, delta, and expiration. See P/L instantly."
                            />
                            <Feature
                                icon={<RefreshCw className="w-4 h-4" />}
                                title="Roll & Chain Trades"
                                description="Roll options forward — trades are linked together so you can track the full chain P/L."
                            />
                            <Feature
                                icon={<TrendingUp className="w-4 h-4" />}
                                title="Stock Positions & Live Prices"
                                description="Assigned CSPs auto-create stock positions. Enable live prices in Settings."
                            />
                            <Feature
                                icon={<FileText className="w-4 h-4" />}
                                title="Import & Export"
                                description="Back up everything to CSV. Supports trades, fund transactions, and stock purchases."
                            />
                        </div>
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Keyboard className="w-4 h-4" />
                            Keyboard Shortcuts
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <Shortcut keys={['N']} action="New trade" />
                                <Shortcut keys={['S']} action="Settings" />
                                <Shortcut keys={['H']} action="Help" />
                                <Shortcut keys={['Esc']} action="Close modal" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="text-sm text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Quick Tip</p>
                        <p>When a CSP is assigned, click the <span className="text-purple-600 dark:text-purple-400 font-medium">CC</span> button on that trade to quickly open a covered call on those shares. Enable <span className="font-medium">Portfolio Mode</span> in Settings to track deposits, withdrawals, and manual stock purchases.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        Don't show this again
                    </label>
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        </div>
    );
};

const Step = ({ number, title, description }) => (
    <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            {number}
        </div>
        <div>
            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{title}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{description}</p>
        </div>
    </div>
);

const StepArrow = () => (
    <div className="flex justify-center pl-3">
        <ArrowDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
    </div>
);

const Feature = ({ icon, title, description }) => (
    <div className="flex items-start gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            {icon}
        </div>
        <div>
            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{title}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{description}</p>
        </div>
    </div>
);

const Shortcut = ({ keys, action }) => (
    <div className="flex items-center justify-between">
        <span className="text-slate-600 dark:text-slate-300">{action}</span>
        <div className="flex gap-1">
            {keys.map((key, i) => (
                <kbd
                    key={i}
                    className="px-2 py-0.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded text-xs font-mono text-slate-700 dark:text-slate-200 shadow-sm"
                >
                    {key}
                </kbd>
            ))}
        </div>
    </div>
);
