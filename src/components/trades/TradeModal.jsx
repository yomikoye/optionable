import React from 'react';
import { X, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

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
    saveTrade
}) => {
    if (!isModalOpen) return null;

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
                                placeholder="e.g. SOXL"
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
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                            <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" disabled={isRolling}>
                                <option value="CSP">CSP (Put)</option>
                                <option value="CC">CC (Call)</option>
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">New Strike *</label>
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

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-600">
                        <div>
                            <label className="block text-xs font-semibold uppercase mb-1 text-emerald-600 dark:text-emerald-400">
                                {isRolling ? 'New Premium *' : 'Entry Premium ($)'}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400">$</span>
                                <input
                                    type="number" step="0.01" name="entryPrice" required
                                    value={formData.entryPrice} onChange={handleInputChange}
                                    className="w-full pl-7 pr-3 py-2 border border-emerald-200 dark:border-emerald-700 rounded-lg focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                    placeholder="Price per share"
                                />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 text-right">
                                Total: {formatCurrency((formData.entryPrice || 0) * (formData.quantity || 0) * 100)}
                            </div>
                        </div>

                        {!isRolling && (
                            <div>
                                <label className="block text-xs font-semibold uppercase mb-1 text-red-500 dark:text-red-400">Close Cost ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">$</span>
                                    <input
                                        type="number" step="0.01" name="closePrice"
                                        value={formData.closePrice} onChange={handleInputChange}
                                        className="w-full pl-7 pr-3 py-2 border border-red-200 dark:border-red-700 rounded-lg focus:ring-red-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
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
                        <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 rounded-lg text-white font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600">
                            {editingId ? 'Update Trade' : isRolling ? 'Roll & Create New' : 'Save Trade'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
