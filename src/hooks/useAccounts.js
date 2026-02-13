import { useState, useEffect, useCallback } from 'react';
import { accountsApi } from '../services/api';

const STORAGE_KEY = 'optionable_selectedAccountId';

export const useAccounts = () => {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountIdState] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? Number(stored) : null;
    });
    const [loading, setLoading] = useState(true);

    const setSelectedAccountId = useCallback((id) => {
        setSelectedAccountIdState(id);
        if (id !== null) {
            localStorage.setItem(STORAGE_KEY, String(id));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await accountsApi.getAll();
            setAccounts(response.data);

            // If selected account no longer exists, reset to "All"
            if (selectedAccountId && !response.data.find(a => a.id === selectedAccountId)) {
                setSelectedAccountId(null);
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedAccountId, setSelectedAccountId]);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const createAccount = useCallback(async (name) => {
        const response = await accountsApi.create({ name });
        await fetchAccounts();
        return response.data;
    }, [fetchAccounts]);

    const renameAccount = useCallback(async (id, name) => {
        const response = await accountsApi.update(id, { name });
        await fetchAccounts();
        return response.data;
    }, [fetchAccounts]);

    const deleteAccount = useCallback(async (id) => {
        await accountsApi.delete(id);
        if (selectedAccountId === id) {
            setSelectedAccountId(null);
        }
        await fetchAccounts();
    }, [fetchAccounts, selectedAccountId, setSelectedAccountId]);

    return {
        accounts,
        selectedAccountId,
        setSelectedAccountId,
        loading,
        fetchAccounts,
        createAccount,
        renameAccount,
        deleteAccount
    };
};
