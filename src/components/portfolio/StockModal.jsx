import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

export const StockModal = ({ isOpen, onClose, onSave, editingStock, isSelling }) => {
    const [formData, setFormData] = useState({});

    // Reset form when modal opens or editing context changes
    useEffect(() => {
        if (isSelling && editingStock) {
            setFormData({
                soldDate: new Date().toISOString().split('T')[0],
                salePrice: '',
            });
        } else if (editingStock) {
            setFormData({
                ticker: editingStock.ticker || '',
                shares: editingStock.shares || '',
                costBasis: editingStock.costBasis || '',
                acquiredDate: editingStock.acquiredDate || '',
                notes: editingStock.notes || '',
            });
        } else {
            setFormData({
                ticker: '',
                shares: '',
                costBasis: '',
                acquiredDate: new Date().toISOString().split('T')[0],
                notes: '',
            });
        }
    }, [editingStock, isSelling, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSelling) {
            onSave({
                soldDate: formData.soldDate,
                salePrice: Number(formData.salePrice),
            });
        } else {
            onSave({
                ...formData,
                shares: Number(formData.shares),
                costBasis: Number(formData.costBasis),
            });
        }
    };

    const totalCost = (Number(formData.shares) || 0) * (Number(formData.costBasis) || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="modal-enter bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full max-w-xl overflow-hidden my-8">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                        {isSelling
                            ? <TrendingDown className="w-5 h-5 text-red-500" />
                            : <TrendingUp className="w-5 h-5 text-emerald-500" />
                        }
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                            {isSelling ? `Sell ${editingStock?.ticker}` : editingStock ? 'Edit Stock' : 'Buy Stock'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {isSelling ? (
                        <>
                            {/* Selling context */}
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <span className="text-red-600 dark:text-red-400 text-xs uppercase font-semibold">Ticker</span>
                                        <p className="font-bold text-red-900 dark:text-red-300">{editingStock?.ticker}</p>
                                    </div>
                                    <div>
                                        <span className="text-red-600 dark:text-red-400 text-xs uppercase font-semibold">Shares</span>
                                        <p className="font-bold text-red-900 dark:text-red-300">{editingStock?.shares}</p>
                                    </div>
                                    <div>
                                        <span className="text-red-600 dark:text-red-400 text-xs uppercase font-semibold">Cost Basis</span>
                                        <p className="font-bold text-red-900 dark:text-red-300">${editingStock?.costBasis}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Sale Date *</label>
                                    <input
                                        type="date"
                                        value={formData.soldDate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, soldDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-red-500 dark:text-red-400 uppercase mb-1">Sale Price (per share) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.salePrice || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, salePrice: e.target.value }))}
                                            className="w-full pl-7 pr-3 py-2 border border-red-200 dark:border-red-700 rounded-lg focus:ring-red-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                            placeholder="Price per share"
                                            required
                                        />
                                    </div>
                                    {formData.salePrice && editingStock && (
                                        <div className="text-xs mt-1 text-right">
                                            <span className={`font-mono font-medium ${(Number(formData.salePrice) - editingStock.costBasis) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                P/L: ${((Number(formData.salePrice) - editingStock.costBasis) * editingStock.shares).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Buy / Edit form */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Ticker *</label>
                                <input
                                    type="text"
                                    value={formData.ticker || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. AAPL"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Shares *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={formData.shares || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, shares: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Cost Basis ($) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.costBasis || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, costBasis: e.target.value }))}
                                            className="w-full pl-7 pr-3 py-2 border border-emerald-200 dark:border-emerald-700 rounded-lg focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                            placeholder="Per share"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Acquired Date *</label>
                                    <input
                                        type="date"
                                        value={formData.acquiredDate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, acquiredDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>

                            {totalCost > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600 text-right">
                                    <span className="text-xs text-slate-400 uppercase mr-2">Total Cost:</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={2}
                                    placeholder="Optional notes about this purchase..."
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                                />
                            </div>
                        </>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white ${
                                isSelling
                                    ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                                    : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                            }`}
                        >
                            {isSelling ? 'Sell Shares' : editingStock ? 'Update Stock' : 'Buy Stock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
