// API Configuration
export const API_URL = '/api';

// App Version
export const APP_VERSION = '0.11.1';

// Pagination
export const TRADES_PER_PAGE = 5;

// Status values
export const STATUS = {
    OPEN: 'Open',
    EXPIRED: 'Expired',
    ASSIGNED: 'Assigned',
    CLOSED: 'Closed',
    ROLLED: 'Rolled'
};

// Trade types
export const TRADE_TYPE = {
    CSP: 'CSP',
    CC: 'CC'
};

// Status filter options
export const STATUS_FILTERS = {
    ALL: 'all',
    OPEN: 'open',
    CLOSED: 'closed'
};

// Fund transaction types
export const FUND_TRANSACTION_TYPES = [
    { value: 'deposit', label: 'Deposit' },
    { value: 'withdrawal', label: 'Withdrawal' },
    { value: 'dividend', label: 'Dividend' },
    { value: 'interest', label: 'Interest' },
    { value: 'fee', label: 'Fee' },
];

// App tabs
export const TABS = {
    OPTIONS: 'options',
    PORTFOLIO: 'portfolio'
};
