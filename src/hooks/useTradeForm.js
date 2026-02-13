import { useState, useCallback } from 'react';
import { API_URL } from '../utils/constants';

const initialFormState = {
    ticker: '',
    openedDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    closedDate: '',
    strike: '',
    type: 'CSP',
    quantity: 1,
    delta: '',
    entryPrice: '',
    closePrice: '',
    status: 'Open',
    parentTradeId: null,
    notes: '',
};

export const useTradeForm = ({ refreshAll, showToast, setError, setCurrentPage, accountId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [editingId, setEditingId] = useState(null);
    const [isRolling, setIsRolling] = useState(false);
    const [rollFromTrade, setRollFromTrade] = useState(null);
    const [rollClosePrice, setRollClosePrice] = useState('');

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const openModal = useCallback((trade = null) => {
        setIsRolling(false);
        setRollFromTrade(null);
        if (trade) {
            setEditingId(trade.id);
            setFormData({
                ticker: trade.ticker,
                openedDate: trade.openedDate,
                expirationDate: trade.expirationDate,
                closedDate: trade.closedDate || '',
                strike: trade.strike,
                type: trade.type,
                quantity: trade.quantity,
                delta: trade.delta || '',
                entryPrice: trade.entryPrice,
                closePrice: trade.closePrice || '',
                status: trade.status,
                parentTradeId: trade.parentTradeId || null,
                notes: trade.notes || '',
            });
        } else {
            setEditingId(null);
            setFormData({
                ...initialFormState,
                openedDate: new Date().toISOString().split('T')[0]
            });
        }
        setIsModalOpen(true);
    }, []);

    const duplicateTrade = useCallback((trade) => {
        setEditingId(null);
        setIsRolling(false);
        setRollFromTrade(null);
        setFormData({
            ticker: trade.ticker,
            openedDate: new Date().toISOString().split('T')[0],
            expirationDate: '',
            closedDate: '',
            strike: trade.strike,
            type: trade.type,
            quantity: trade.quantity,
            delta: '',
            entryPrice: '',
            closePrice: '',
            status: 'Open',
            parentTradeId: null,
            notes: '',
        });
        setIsModalOpen(true);
    }, []);

    const rollTrade = useCallback((trade) => {
        setEditingId(null);
        setIsRolling(true);
        setRollFromTrade(trade);
        setRollClosePrice('');
        setFormData({
            ticker: trade.ticker,
            openedDate: new Date().toISOString().split('T')[0],
            expirationDate: '',
            closedDate: '',
            strike: '',
            type: trade.type,
            quantity: trade.quantity,
            delta: '',
            entryPrice: '',
            closePrice: '',
            status: 'Open',
            parentTradeId: trade.id,
            notes: '',
        });
        setIsModalOpen(true);
    }, []);

    const openCoveredCall = useCallback((cspTrade) => {
        setEditingId(null);
        setIsRolling(false);
        setRollFromTrade(null);
        setFormData({
            ticker: cspTrade.ticker,
            openedDate: new Date().toISOString().split('T')[0],
            expirationDate: '',
            closedDate: '',
            strike: '',
            type: 'CC',
            quantity: cspTrade.quantity,
            delta: '',
            entryPrice: '',
            closePrice: '',
            status: 'Open',
            parentTradeId: cspTrade.id,
            notes: '',
        });
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setFormData(initialFormState);
        setEditingId(null);
        setIsRolling(false);
        setRollFromTrade(null);
        setRollClosePrice('');
    }, []);

    const saveTrade = useCallback(async (e) => {
        e.preventDefault();

        // Validation for rolling
        if (isRolling && rollFromTrade) {
            if (!rollClosePrice && rollClosePrice !== 0) {
                setError('Please enter the close cost for the original position');
                return;
            }
            if (!formData.strike) {
                setError('Please enter the new strike price');
                return;
            }
            if (!formData.entryPrice) {
                setError('Please enter the new premium');
                return;
            }
            if (!formData.expirationDate) {
                setError('Please enter the new expiration date');
                return;
            }
        }

        const tradeData = {
            ticker: formData.ticker,
            type: formData.type,
            strike: Number(formData.strike),
            quantity: Number(formData.quantity),
            delta: formData.delta ? Number(formData.delta) : null,
            entryPrice: Number(formData.entryPrice),
            closePrice: formData.closePrice ? Number(formData.closePrice) : 0,
            openedDate: formData.openedDate,
            expirationDate: formData.expirationDate,
            closedDate: formData.closedDate || null,
            status: formData.status,
            parentTradeId: formData.parentTradeId || null,
            notes: formData.notes || null,
            accountId: accountId || null,
        };

        try {
            if (isRolling && rollFromTrade) {
                const response = await fetch(`${API_URL}/trades/roll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originalTradeId: rollFromTrade.id,
                        closePrice: Number(rollClosePrice),
                        newTrade: tradeData,
                    }),
                });

                if (!response.ok) throw new Error('Failed to roll trade');
            } else {
                const url = editingId ? `${API_URL}/trades/${editingId}` : `${API_URL}/trades`;
                const method = editingId ? 'PUT' : 'POST';

                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tradeData),
                });

                if (!response.ok) throw new Error('Failed to save trade');
            }

            await refreshAll();
            closeModal();
            if (!editingId) setCurrentPage(1);
        } catch (err) {
            console.error('Error saving trade:', err);
            setError('Failed to save trade. Please try again.');
        }
    }, [isRolling, rollFromTrade, rollClosePrice, formData, editingId, refreshAll, closeModal, setError, setCurrentPage]);

    const deleteTrade = useCallback(async (id) => {
        if (!window.confirm('Are you sure you want to delete this trade?')) return;

        try {
            const response = await fetch(`${API_URL}/trades/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete trade');
            await refreshAll();
            showToast('Trade deleted');
        } catch (err) {
            console.error('Error deleting trade:', err);
            setError('Failed to delete trade. Please try again.');
        }
    }, [refreshAll, showToast, setError]);

    const quickCloseTrade = useCallback(async (trade) => {
        try {
            const response = await fetch(`${API_URL}/trades/${trade.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...trade,
                    closePrice: 0,
                    closedDate: new Date().toISOString().split('T')[0],
                    status: 'Expired',
                }),
            });
            if (!response.ok) throw new Error('Failed to close trade');
            await refreshAll();
            showToast(`${trade.ticker} closed at $0`);
        } catch (err) {
            console.error('Error closing trade:', err);
            setError('Failed to close trade. Please try again.');
        }
    }, [refreshAll, showToast, setError]);

    return {
        isModalOpen,
        formData,
        setFormData,
        editingId,
        isRolling,
        rollFromTrade,
        rollClosePrice,
        setRollClosePrice,
        handleInputChange,
        openModal,
        closeModal,
        duplicateTrade,
        rollTrade,
        openCoveredCall,
        saveTrade,
        deleteTrade,
        quickCloseTrade
    };
};
