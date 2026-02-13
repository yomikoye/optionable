import React from 'react';
import { PortfolioDashboard } from './PortfolioDashboard';
import { MonthlyPLChart } from './MonthlyPLChart';
import { IncomeSourcesChart } from './IncomeSourcesChart';
import { FundJournal } from './FundJournal';
import { StocksTable } from './StocksTable';

export const PortfolioView = ({
    portfolioStats,
    monthlyData,
    darkMode,
    fundTransactions,
    stocks,
    onCreateFundTransaction,
    onUpdateFundTransaction,
    onDeleteFundTransaction,
    onCreateStock,
    onUpdateStock,
    onDeleteStock,
    showToast,
    selectedAccountId,
    buyStockTrigger
}) => {
    return (
        <div className="space-y-6">
            <PortfolioDashboard stats={portfolioStats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MonthlyPLChart data={monthlyData} darkMode={darkMode} />
                <IncomeSourcesChart stats={portfolioStats} />
            </div>
            <FundJournal
                transactions={fundTransactions}
                onCreate={onCreateFundTransaction}
                onUpdate={onUpdateFundTransaction}
                onDelete={onDeleteFundTransaction}
                showToast={showToast}
                selectedAccountId={selectedAccountId}
            />
            <StocksTable
                stocks={stocks}
                onCreate={onCreateStock}
                onUpdate={onUpdateStock}
                onDelete={onDeleteStock}
                showToast={showToast}
                selectedAccountId={selectedAccountId}
                buyTrigger={buyStockTrigger}
            />
        </div>
    );
};
