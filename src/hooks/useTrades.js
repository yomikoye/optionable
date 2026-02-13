import { useState, useEffect, useCallback, useRef } from 'react';
import { tradesApi } from '../services/api';

export const useTrades = (accountId) => {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const prevAccountId = useRef(accountId);

    const fetchTrades = useCallback(async () => {
        try {
            setLoading(true);
            const params = { limit: 1000 };
            if (accountId) params.accountId = accountId;
            const response = await tradesApi.getAll(params);
            setTrades(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching trades:', err);
            setError('Failed to load trades. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    useEffect(() => {
        fetchTrades();
    }, [fetchTrades]);

    // Re-fetch when account changes
    useEffect(() => {
        if (prevAccountId.current !== accountId) {
            prevAccountId.current = accountId;
            fetchTrades();
        }
    }, [accountId, fetchTrades]);

    return {
        trades,
        loading,
        error,
        setError,
        fetchTrades
    };
};
