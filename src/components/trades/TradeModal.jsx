import React, { useState } from 'react';
import { X, RefreshCw, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { isBuySide } from '../../utils/constants';

const TRADE_TYPE_INFO = {
    CSP: { label: 'CSP (Sell Put)', description: 'Cash Secured Put — Sell a put, collect premium. Obligated to buy shares at strike if assigned.' },
    CC: { label: 'CC (Sell Call)', description: 'Covered Call — Sell a call on shares you own, collect premium. Obligated to sell at strike if assigned.' },
    CALL: { label: 'Call (Buy)', description: 'Long Call — Pay premium for the right to buy shares at strike. Profit when stock rises above strike + premium.' },
    PUT: { label: 'Put (Buy)', description: 'Long Put — Pay premium for the right to sell shares at strike. Profit when stock falls below strike - premium.' },
};

export const TradeModal = ({
    isModalOpen,
    formData,
    setFormData,
    editingId,
    isRolling,
    rollFromTrade,
    rollClosePrice,
    setRollClosePrice,
    handleInputChange,
    closeModal,
    saveTrade,
    accounts,
    selectedAccountId,
    modalAccountId,
    setModalAccountId
}) => {
    const [showTypeHelp, setShowTypeHelp] = useState(false);

    if (!isModalOpen) return null;

    const needsAccountPicker = !selectedAccountId && !editingId && !isRolling;
    const isBuy = isBuySide(formData.type);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="modal-enter bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full max-w-xl overflow-hidden my-8">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                            {editingId ? 'Edit Trade' : isRolling ? 'Roll Trade' : 'New Trade'}
                        </h2>
                        {isRolling && rollFromTrade && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" />
                                Rolling {rollFromTrade.ticker} ${rollFromTrade.strike} {rollFromTrade.type}
                            </p>
                        )}
                    </div>
                    <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={saveTrade} className="p-6 space-y-4">

                    {/* Account Picker (only when creating new trade with no account selected) */}
                    {needsAccountPicker && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Account *</label>
                            <select
                                value={modalAccountId || ''}
                                onChange={(e) => setModalAccountId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                required
                            >
                                <option value="">Select account...</option>
                                {(accounts || []).map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Original Trade Close Section (only when rolling) */}
                    {isRolling && rollFromTrade && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                            <h3 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Close Original Position
                            </h3>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <span className="text-amber-600 text-xs">Ticker</span>
                                    <p className="font-bold text-amber-900">{rollFromTrade.ticker}</p>
                                </div>
                                <div>
                                    <span className="text-amber-600 text-xs">Strike</span>
                                    <p className="font-bold text-amber-900">${rollFromTrade.strike}</p>
                                </div>
                                <div>
                                    <span className="text-amber-600 text-xs">Entry Premium</span>
                                    <p className="font-bold text-emerald-600">${rollFromTrade.entryPrice}</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-amber-700 uppercase mb-1">
                                    Close Cost (per share) *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-amber-400">$</span>
                                    <input
                                        type="number" step="0.01" required
                                        value={rollClosePrice}
                                        onChange={(e) => setRollClosePrice(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 border border-amber-300 rounded-lg focus:ring-amber-500 bg-white"
                                        placeholder="Cost to buy back original"
                                    />
                                </div>
                                <div className="text-xs text-amber-600 mt-1">
                                    Original P/L: {formatCurrency((rollFromTrade.entryPrice - (Number(rollClosePrice) || 0)) * rollFromTrade.quantity * 100)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* New Trade Section Header (only when rolling) */}
                    {isRolling && (
                        <div className="border-t border-slate-200 pt-4">
                            <h3 className="font-semibold text-indigo-700 text-sm mb-3">New Rolled Position</h3>
                        </div>
                    )}

                    <div className="grid grid-cols-1">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Ticker</label>
                            <input
                                type="text" name="ticker" required
                                value={formData.ticker} onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                placeholder="e.g. GOOG"
                                readOnly={isRolling}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Opened</label>
                            <input type="date" name="openedDate" required value={formData.openedDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Expiration *</label>
                            <input type="date" name="expirationDate" required value={formData.expirationDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Closed (Opt)</label>
                            <input type="date" name="closedDate" value={formData.closedDate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                                Type
                                <button
                                    type="button"
                                    onClick={() => setShowTypeHelp(!showTypeHelp)}
                                    className="text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                    <Info className="w-3 h-3" />
                                </button>
                            </label>
                            <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" disabled={isRolling}>
                                {Object.entries(TRADE_TYPE_INFO).map(([key, info]) => (
                                    <option key={key} value={key}>{info.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Strike *</label>
                            <input type="number" step="0.5" name="strike" required value={formData.strike} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" placeholder="0.00" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Qty</label>
                            <input type="number" name="quantity" required value={formData.quantity} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Delta</label>
                            <input type="number" step="0.01" min="0" max="1" name="delta" value={formData.delta} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" placeholder="0.30" />
                        </div>
                    </div>

                    {/* Type help tooltip */}
                    {showTypeHelp && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 space-y-2">
                            {Object.entries(TRADE_TYPE_INFO).map(([key, info]) => (
                                <div key={key} className="flex gap-2">
                                    <span className={`text-xs font-bold min-w-[52px] ${
                                        key === 'CSP' ? 'text-blue-600' :
                                        key === 'CC' ? 'text-purple-600' :
                                        key === 'CALL' ? 'text-emerald-600' :
                                        'text-orange-600'
                                    }`}>{key}</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-300">{info.description}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-600">
                        <div>
                            <label className={`block text-xs font-semibold uppercase mb-1 ${
                                isBuy
                                    ? 'text-red-500 dark:text-red-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                                {isRolling ? 'New Premium *' : isBuy ? 'Premium Paid ($)' : 'Entry Premium ($)'}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400">$</span>
                                <input
                                    type="number" step="0.01" name="entryPrice" required
                                    value={formData.entryPrice} onChange={handleInputChange}
                                    className={`w-full pl-7 pr-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${
                                        isBuy
                                            ? 'border-red-200 dark:border-red-700 focus:ring-red-500'
                                            : 'border-emerald-200 dark:border-emerald-700 focus:ring-emerald-500'
                                    }`}
                                    placeholder="Price per share"
                                />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 text-right">
                                Total: {formatCurrency((formData.entryPrice || 0) * (formData.quantity || 0) * 100)}
                                {isBuy && <span className="ml-1">(debit)</span>}
                            </div>
                        </div>

                        {!isRolling && (
                            <div>
                                <label className={`block text-xs font-semibold uppercase mb-1 ${
                                    isBuy
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-red-500 dark:text-red-400'
                                }`}>
                                    {isBuy ? 'Sell Price ($)' : 'Close Cost ($)'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">$</span>
                                    <input
                                        type="number" step="0.01" name="closePrice"
                                        value={formData.closePrice} onChange={handleInputChange}
                                        className={`w-full pl-7 pr-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${
                                            isBuy
                                                ? 'border-emerald-200 dark:border-emerald-700 focus:ring-emerald-500'
                                                : 'border-red-200 dark:border-red-700 focus:ring-red-500'
                                        }`}
                                        placeholder="0.00 if open"
                                    />
                                </div>
                            </div>
                        )}

                        {isRolling && (
                            <div className="flex flex-col justify-center">
                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">Net Credit/Debit</div>
                                <div className={`text-xl font-bold ${((Number(formData.entryPrice) || 0) - (Number(rollClosePrice) || 0)) >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                    }`}>
                                    {formatCurrency(((Number(formData.entryPrice) || 0) - (Number(rollClosePrice) || 0)) * (formData.quantity || 1) * 100)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {((Number(formData.entryPrice) || 0) - (Number(rollClosePrice) || 0)) >= 0 ? 'Credit' : 'Debit'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Commission */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Commission ($)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <input
                                type="number" step="0.01" min="0" name="commission"
                                value={formData.commission} onChange={handleInputChange}
                                className="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                placeholder="Auto"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Leave blank to auto-calculate from account rate</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Notes</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                            placeholder="Optional notes about this trade..."
                        />
                    </div>

                    {!isRolling && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                            <div className="grid grid-cols-4 gap-2">
                                {['Open', 'Expired', 'Assigned', 'Closed'].map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                                        className={`py-2 text-xs font-medium rounded-lg border ${formData.status === s
                                            ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500'
                                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Use the Roll button to roll a trade</p>
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
                        <button type="submit" disabled={needsAccountPicker && !modalAccountId} className="flex-1 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 rounded-lg text-white font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-600">
                            {editingId ? 'Update Trade' : isRolling ? 'Roll & Create New' : 'Save Trade'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
