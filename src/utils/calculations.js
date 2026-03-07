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
// liveOptionPrice: optional live price for open CALL/PUT trades (unrealized P/L)
export const calculateMetrics = (trade, liveOptionPrice) => {
    const quantity = parseFloat(trade.quantity) || 0;
    const strike = parseFloat(trade.strike) || 0;
    const entryPrice = parseFloat(trade.entryPrice) || 0;
    const commission = parseFloat(trade.commission) || 0;
    const isBuy = trade.type === 'CALL' || trade.type === 'PUT';

    // For any open trade with a live option price, use it as current value for unrealized P/L
    const effectiveClosePrice = (trade.status === 'Open' && liveOptionPrice != null)
        ? liveOptionPrice
        : (parseFloat(trade.closePrice) || 0);

    const totalPremium = entryPrice * quantity * 100;
    const totalCloseCost = effectiveClosePrice * quantity * 100;

    // Sell-side (CSP/CC): P/L = premium collected - close cost - commission
    // Buy-side (CALL/PUT): P/L = close proceeds - premium paid - commission
    const pnl = isBuy
        ? totalCloseCost - totalPremium - commission
        : totalPremium - totalCloseCost - commission;

    // Sell-side collateral = strike * qty * 100 (cash secured)
    // Buy-side cost = premium paid (max loss)
    const collateral = isBuy ? totalPremium : strike * quantity * 100;
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
