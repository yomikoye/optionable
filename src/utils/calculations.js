// Calculate Days to Expiration
export const calculateDTE = (expirationDate, status) => {
    if (status !== 'Open') return null;
    if (!expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Calculate days held for a trade
export const calculateDaysHeld = (trade) => {
    const openDate = new Date(trade.openedDate);
    const closeDate = trade.closedDate
        ? new Date(trade.closedDate)
        : (trade.status === 'Open' ? new Date() : new Date(trade.expirationDate));
    const diffTime = Math.abs(closeDate - openDate);
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// Calculate trade metrics (P/L, ROI, etc.)
export const calculateMetrics = (trade) => {
    const quantity = parseFloat(trade.quantity) || 0;
    const strike = parseFloat(trade.strike) || 0;
    const entryPrice = parseFloat(trade.entryPrice) || 0;
    const closePrice = parseFloat(trade.closePrice) || 0;

    const totalPremium = entryPrice * quantity * 100;
    const totalCloseCost = closePrice * quantity * 100;
    const pnl = totalPremium - totalCloseCost;

    const collateral = strike * quantity * 100;
    const roi = collateral > 0 ? (pnl / collateral) * 100 : 0;

    const daysHeld = calculateDaysHeld(trade);
    const annualizedRoi = daysHeld > 0 ? (roi / daysHeld) * 365 : 0;

    const maxProfitPercent = totalPremium > 0
        ? ((totalPremium - totalCloseCost) / totalPremium) * 100
        : 0;

    return {
        totalPremium,
        totalCloseCost,
        pnl,
        roi,
        collateral,
        maxProfitPercent,
        annualizedRoi,
        daysHeld
    };
};
