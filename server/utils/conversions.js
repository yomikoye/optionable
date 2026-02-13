// All prices stored as INTEGER cents, converted at API boundary

export const toCents = (dollars) => {
    if (dollars === null || dollars === undefined) return null;
    return Math.round(Number(dollars) * 100);
};

export const toDollars = (cents) => {
    if (cents === null || cents === undefined) return null;
    return cents / 100;
};

// Convert a trade object from DB (cents) to API (dollars)
export const tradeToApi = (trade) => {
    if (!trade) return null;
    return {
        ...trade,
        strike: toDollars(trade.strike),
        entryPrice: toDollars(trade.entryPrice),
        closePrice: toDollars(trade.closePrice)
    };
};

// Convert a position object from DB (cents) to API (dollars)
export const positionToApi = (position) => {
    if (!position) return null;
    return {
        ...position,
        costBasis: toDollars(position.costBasis),
        salePrice: toDollars(position.salePrice),
        capitalGainLoss: toDollars(position.capitalGainLoss)
    };
};

// Convert a fund transaction from DB (cents) to API (dollars)
export const fundTransactionToApi = (txn) => {
    if (!txn) return null;
    return {
        ...txn,
        amount: toDollars(txn.amount)
    };
};

// Convert a stock from DB (cents) to API (dollars)
export const stockToApi = (stock) => {
    if (!stock) return null;
    return {
        ...stock,
        costBasis: toDollars(stock.costBasis),
        salePrice: toDollars(stock.salePrice),
        capitalGainLoss: toDollars(stock.capitalGainLoss)
    };
};
