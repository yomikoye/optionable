import { API_URL } from '../utils/constants';

// Generic API request handler
const request = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    const json = await response.json();

    if (!response.ok) {
        throw new Error(json.error?.message || 'Request failed');
    }

    return json;
};

// Trades API
export const tradesApi = {
    // Get all trades with optional filters
    getAll: async (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, value);
            }
        });
        const query = searchParams.toString();
        return request(`/trades${query ? `?${query}` : ''}`);
    },

    // Get single trade by ID
    getById: async (id) => {
        return request(`/trades/${id}`);
    },

    // Create new trade
    create: async (tradeData) => {
        return request('/trades', {
            method: 'POST',
            body: JSON.stringify(tradeData)
        });
    },

    // Update existing trade
    update: async (id, tradeData) => {
        return request(`/trades/${id}`, {
            method: 'PUT',
            body: JSON.stringify(tradeData)
        });
    },

    // Delete trade
    delete: async (id) => {
        return request(`/trades/${id}`, {
            method: 'DELETE'
        });
    },

    // Bulk import trades
    import: async (trades) => {
        return request('/trades/import', {
            method: 'POST',
            body: JSON.stringify({ trades })
        });
    },

    // Roll trade (atomic close + create new)
    roll: async (originalTradeId, closePrice, newTrade) => {
        return request('/trades/roll', {
            method: 'POST',
            body: JSON.stringify({ originalTradeId, closePrice, newTrade })
        });
    }
};

// Stats API
export const statsApi = {
    get: async () => {
        return request('/stats');
    }
};

// Settings API
export const settingsApi = {
    getAll: async () => {
        return request('/settings');
    },
    update: async (key, value) => {
        return request(`/settings/${key}`, {
            method: 'PUT',
            body: JSON.stringify({ value })
        });
    }
};

// Health API
export const healthApi = {
    check: async () => {
        return request('/health');
    }
};

// Accounts API
export const accountsApi = {
    getAll: async () => {
        return request('/accounts');
    },
    getById: async (id) => {
        return request(`/accounts/${id}`);
    },
    create: async (data) => {
        return request('/accounts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    update: async (id, data) => {
        return request(`/accounts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    delete: async (id) => {
        return request(`/accounts/${id}`, {
            method: 'DELETE'
        });
    }
};

// Fund Transactions API
export const fundTransactionsApi = {
    getAll: async (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, value);
            }
        });
        const query = searchParams.toString();
        return request(`/fund-transactions${query ? `?${query}` : ''}`);
    },
    create: async (data) => {
        return request('/fund-transactions', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    update: async (id, data) => {
        return request(`/fund-transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    delete: async (id) => {
        return request(`/fund-transactions/${id}`, {
            method: 'DELETE'
        });
    }
};

// Stocks API
export const stocksApi = {
    getAll: async (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, value);
            }
        });
        const query = searchParams.toString();
        return request(`/stocks${query ? `?${query}` : ''}`);
    },
    create: async (data) => {
        return request('/stocks', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    update: async (id, data) => {
        return request(`/stocks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    delete: async (id) => {
        return request(`/stocks/${id}`, {
            method: 'DELETE'
        });
    }
};

// Portfolio API
export const portfolioApi = {
    getStats: async (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, value);
            }
        });
        const query = searchParams.toString();
        return request(`/portfolio/stats${query ? `?${query}` : ''}`);
    },
    getMonthly: async (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, value);
            }
        });
        const query = searchParams.toString();
        return request(`/portfolio/monthly${query ? `?${query}` : ''}`);
    }
};
