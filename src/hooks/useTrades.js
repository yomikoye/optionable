import { useState, useEffect, useCallback } from 'react';
import { tradesApi } from '../services/api';

export const useTrades = () => {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTrades = useCallback(async () => {
        try {
            setLoading(true);
            const response = await tradesApi.getAll({ limit: 1000 });
            setTrades(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching trades:', err);
            setError('Failed to load trades. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrades();
    }, [fetchTrades]);

    const createTrade = async (tradeData) => {
        await tradesApi.create(tradeData);
        await fetchTrades();
    };

    const updateTrade = async (id, tradeData) => {
        await tradesApi.update(id, tradeData);
        await fetchTrades();
    };

    const deleteTrade = async (id) => {
        await tradesApi.delete(id);
        await fetchTrades();
    };

    const importTrades = async (tradesToImport) => {
        const response = await tradesApi.import(tradesToImport);
        await fetchTrades();
        return response.data.imported;
    };

    return {
        trades,
        loading,
        error,
        setError,
        fetchTrades,
        createTrade,
        updateTrade,
        deleteTrade,
        importTrades
    };
};
