import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { FundTransactionModal } from './FundTransactionModal';

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    const num = Number(value);
    const sign = num >= 0 ? '' : '-';
    return `${sign}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const typeColors = {
    deposit: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    withdrawal: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dividend: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    interest: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    fee: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

export const FundJournal = ({ transactions, onCreate, onUpdate, onDelete, showToast, selectedAccountId }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);

    const handleSave = async (data) => {
        try {
            if (editingTransaction) {
                await onUpdate(editingTransaction.id, data);
                showToast?.('Transaction updated', 'success');
            } else {
                await onCreate(data);
                showToast?.('Transaction added', 'success');
            }
            setShowModal(false);
            setEditingTransaction(null);
        } catch (err) {
            showToast?.('Failed to save transaction', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this transaction?')) return;
        try {
            await onDelete(id);
            showToast?.('Transaction deleted', 'success');
        } catch (err) {
            showToast?.('Failed to delete transaction', 'error');
        }
    };

    const handleEdit = (txn) => {
        setEditingTransaction(txn);
        setShowModal(true);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Fund Journal</h3>
                <button
                    onClick={() => { setEditingTransaction(null); setShowModal(true); }}
                    disabled={!selectedAccountId}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    title={!selectedAccountId ? 'Select an account first' : 'Add transaction'}
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>

            {transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                    No transactions yet. Add deposits, withdrawals, dividends, and other cash flows.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left p-3 text-slate-500 dark:text-slate-400 font-medium">Date</th>
                                <th className="text-left p-3 text-slate-500 dark:text-slate-400 font-medium">Type</th>
                                <th className="text-right p-3 text-slate-500 dark:text-slate-400 font-medium">Amount</th>
                                <th className="text-left p-3 text-slate-500 dark:text-slate-400 font-medium">Description</th>
                                <th className="text-right p-3 text-slate-500 dark:text-slate-400 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(txn => (
                                <tr key={txn.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="p-3 text-slate-700 dark:text-slate-300">{txn.date}</td>
                                    <td className="p-3">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${typeColors[txn.type] || ''}`}>
                                            {txn.type}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-900 dark:text-white">
                                        {formatCurrency(txn.amount)}
                                    </td>
                                    <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                                        {txn.description || '-'}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleEdit(txn)}
                                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(txn.id)}
                                                className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <FundTransactionModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingTransaction(null); }}
                onSave={handleSave}
                editingTransaction={editingTransaction}
            />
        </div>
    );
};
