import { useState, useEffect, useCallback } from 'react';
import { fundTransactionsApi, stocksApi, portfolioApi } from '../services/api';

export const usePortfolio = (accountId) => {
    const [fundTransactions, setFundTransactions] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [portfolioStats, setPortfolioStats] = useState(null);
    const [monthlyData, setMonthlyData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchFundTransactions = useCallback(async () => {
        try {
            const params = {};
            if (accountId) params.accountId = accountId;
            const response = await fundTransactionsApi.getAll(params);
            setFundTransactions(response.data);
        } catch (err) {
            console.error('Error fetching fund transactions:', err);
        }
    }, [accountId]);

    const fetchStocks = useCallback(async () => {
        try {
            const params = {};
            if (accountId) params.accountId = accountId;
            const response = await stocksApi.getAll(params);
            setStocks(response.data);
        } catch (err) {
            console.error('Error fetching stocks:', err);
        }
    }, [accountId]);

    const fetchPortfolioStats = useCallback(async () => {
        try {
            const params = {};
            if (accountId) params.accountId = accountId;
            const [statsRes, monthlyRes] = await Promise.all([
                portfolioApi.getStats(params),
                portfolioApi.getMonthly(params)
            ]);
            setPortfolioStats(statsRes.data);
            setMonthlyData(monthlyRes.data);
        } catch (err) {
            console.error('Error fetching portfolio stats:', err);
        }
    }, [accountId]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchFundTransactions(), fetchStocks(), fetchPortfolioStats()]);
        setLoading(false);
    }, [fetchFundTransactions, fetchStocks, fetchPortfolioStats]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // Fund transaction CRUD
    const createFundTransaction = useCallback(async (data) => {
        await fundTransactionsApi.create({ ...data, accountId: accountId || data.accountId });
        await Promise.all([fetchFundTransactions(), fetchPortfolioStats()]);
    }, [accountId, fetchFundTransactions, fetchPortfolioStats]);

    const updateFundTransaction = useCallback(async (id, data) => {
        await fundTransactionsApi.update(id, data);
        await Promise.all([fetchFundTransactions(), fetchPortfolioStats()]);
    }, [fetchFundTransactions, fetchPortfolioStats]);

    const deleteFundTransaction = useCallback(async (id) => {
        await fundTransactionsApi.delete(id);
        await Promise.all([fetchFundTransactions(), fetchPortfolioStats()]);
    }, [fetchFundTransactions, fetchPortfolioStats]);

    // Stock CRUD
    const createStock = useCallback(async (data) => {
        await stocksApi.create({ ...data, accountId: accountId || data.accountId });
        await Promise.all([fetchStocks(), fetchPortfolioStats()]);
    }, [accountId, fetchStocks, fetchPortfolioStats]);

    const updateStock = useCallback(async (id, data) => {
        await stocksApi.update(id, data);
        await Promise.all([fetchStocks(), fetchPortfolioStats()]);
    }, [fetchStocks, fetchPortfolioStats]);

    const deleteStock = useCallback(async (id) => {
        await stocksApi.delete(id);
        await Promise.all([fetchStocks(), fetchPortfolioStats()]);
    }, [fetchStocks, fetchPortfolioStats]);

    return {
        fundTransactions,
        stocks,
        portfolioStats,
        monthlyData,
        loading,
        fetchAll,
        createFundTransaction,
        updateFundTransaction,
        deleteFundTransaction,
        createStock,
        updateStock,
        deleteStock
    };
};
