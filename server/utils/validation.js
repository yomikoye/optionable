export const VALID_TYPES = ['CSP', 'CC'];
export const VALID_STATUSES = ['Open', 'Expired', 'Assigned', 'Closed', 'Rolled'];

export const validateTrade = (trade, isUpdate = false) => {
    const errors = [];

    // Required fields (only for create, not update)
    if (!isUpdate) {
        if (!trade.ticker || typeof trade.ticker !== 'string' || trade.ticker.trim() === '') {
            errors.push('ticker is required');
        }
        if (!trade.type) errors.push('type is required');
        if (trade.strike === undefined || trade.strike === null) errors.push('strike is required');
        if (trade.entryPrice === undefined || trade.entryPrice === null) errors.push('entryPrice is required');
        if (!trade.openedDate) errors.push('openedDate is required');
        if (!trade.expirationDate) errors.push('expirationDate is required');
    }

    // Type validation
    if (trade.type !== undefined && !VALID_TYPES.includes(trade.type)) {
        errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // Status validation
    if (trade.status !== undefined && !VALID_STATUSES.includes(trade.status)) {
        errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Numeric validations
    if (trade.strike !== undefined && trade.strike !== null) {
        const strike = Number(trade.strike);
        if (isNaN(strike) || strike <= 0) errors.push('strike must be a positive number');
    }

    if (trade.quantity !== undefined && trade.quantity !== null) {
        const qty = Number(trade.quantity);
        if (isNaN(qty) || qty < 1 || !Number.isInteger(qty)) errors.push('quantity must be a positive integer');
    }

    if (trade.entryPrice !== undefined && trade.entryPrice !== null) {
        const price = Number(trade.entryPrice);
        if (isNaN(price) || price < 0) errors.push('entryPrice must be a non-negative number');
    }

    if (trade.closePrice !== undefined && trade.closePrice !== null) {
        const price = Number(trade.closePrice);
        if (isNaN(price) || price < 0) errors.push('closePrice must be a non-negative number');
    }

    if (trade.delta !== undefined && trade.delta !== null && trade.delta !== '') {
        const delta = Number(trade.delta);
        if (isNaN(delta) || delta < 0 || delta > 1) errors.push('delta must be between 0 and 1');
    }

    // Date validations
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (trade.openedDate !== undefined && trade.openedDate !== null) {
        if (!dateRegex.test(trade.openedDate)) errors.push('openedDate must be in YYYY-MM-DD format');
    }

    if (trade.expirationDate !== undefined && trade.expirationDate !== null) {
        if (!dateRegex.test(trade.expirationDate)) errors.push('expirationDate must be in YYYY-MM-DD format');
    }

    if (trade.closedDate !== undefined && trade.closedDate !== null && trade.closedDate !== '') {
        if (!dateRegex.test(trade.closedDate)) errors.push('closedDate must be in YYYY-MM-DD format');
    }

    // Date logic: expiration should be >= opened
    if (trade.openedDate && trade.expirationDate && trade.openedDate > trade.expirationDate) {
        errors.push('expirationDate must be on or after openedDate');
    }

    return errors;
};

export const validatePosition = (position, isUpdate = false) => {
    const errors = [];

    if (!isUpdate) {
        if (!position.ticker || typeof position.ticker !== 'string') errors.push('ticker is required');
        if (position.shares === undefined) errors.push('shares is required');
        if (position.costBasis === undefined) errors.push('costBasis is required');
        if (!position.acquiredDate) errors.push('acquiredDate is required');
    }

    if (position.shares !== undefined) {
        const shares = Number(position.shares);
        if (isNaN(shares) || shares < 1 || !Number.isInteger(shares)) errors.push('shares must be a positive integer');
    }

    if (position.costBasis !== undefined) {
        const cost = Number(position.costBasis);
        if (isNaN(cost) || cost < 0) errors.push('costBasis must be a non-negative number');
    }

    if (position.salePrice !== undefined && position.salePrice !== null) {
        const price = Number(position.salePrice);
        if (isNaN(price) || price < 0) errors.push('salePrice must be a non-negative number');
    }

    return errors;
};
