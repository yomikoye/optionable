# Optionable

A self-hosted wheel strategy tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs) with multi-account support and portfolio management.

![Version](https://img.shields.io/badge/version-0.11.1-blue)
![Docker](https://img.shields.io/badge/docker-yomikoye%2Foptionable-green)
![Platforms](https://img.shields.io/badge/platforms-amd64%20%7C%20arm64-lightgrey)

## Philosophy

Optionable is designed to be **fast, fully local, and self-contained**. Everything runs on your own hardware with no accounts to create, no cloud sync, and no brokerage connections required. Your trade data lives in a local SQLite database that you own completely.

The only external dependency is optional live stock prices via [stockprices.dev](https://stockprices.dev), used for unrealized P/L on open positions. This can be disabled in settings, making the app fully offline-capable.

## Features

### Options Tracking
- **Dashboard** - Premium collected, ROI, win rate, stock gains, total P/L, deployed capital
- **Capital Gains Tracking** - Track stock positions from CSP assignments through CC sales
- **P/L Chart** - Cumulative profit/loss visualization with time period filters (1M, 3M, 6M, YTD, All)
- **Trade Log** - Full trade history with chain grouping, sorting, filtering, pagination
- **Trade Chains** - Rolled trades and CSP→CC sequences grouped together
- **Positions Table** - Track open and closed stock positions with realized/unrealized gains
- **Roll Tracking** - Link rolled trades to track full position chains
- **Analytics** - Monthly and per-ticker P/L breakdowns

### Multi-Account
- **Multiple Accounts** - Track trades across different brokerage accounts
- **Account Selector** - Filter all views by account or view "All Accounts"
- **Account Management** - Create, rename, and delete accounts in Settings

### Portfolio Mode (toggle in Settings)
- **Portfolio Dashboard** - KPI cards: Deposited, Total P/L, Rate of Return, Options P/L, Stock Gains, Income
- **Fund Journal** - Track deposits, withdrawals, dividends, interest, and fees
- **Manual Stock Tracking** - Buy/sell stocks with P/L calculation, ticker aggregation, expandable lots
- **Monthly P/L Chart** - Stacked bar chart breaking down monthly returns by source (options, stocks, income)
- **Income Sources Chart** - Donut chart showing income breakdown by category
- **Context-Aware UI** - Header button switches between "New Trade" and "Buy Stock" based on active tab

### General
- **Live Stock Prices** - Optional real-time prices for unrealized G/L (via [stockprices.dev](https://stockprices.dev), can be disabled)
- **Auto Calculations** - P/L, ROI, annualized ROI, DTE, collateral
- **CSV Import/Export** - Multi-section format supporting trades, fund transactions, and stocks (backward compatible with old CSVs)
- **Dark Mode** - Toggle in Settings
- **Keyboard Shortcuts** - N (new trade), S (settings), H (help), Esc (close)
- **Welcome Guide** - First-time user onboarding with wheel strategy walkthrough (toggleable in Settings)
- **Trade Notes** - Add optional notes to each trade
- **Expiry Confirmation** - Optional confirmation dialog before expiring trades (configurable in settings)

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

### Docker

```bash
# Pull and run
docker run -d -p 8080:8080 -v optionable-data:/data yomikoye/optionable:latest

# Or with docker-compose
docker compose up -d
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check with version |
| GET | `/api/trades` | List trades (`?accountId=X&status=Open&ticker=META`) |
| GET | `/api/trades/:id` | Get single trade |
| POST | `/api/trades` | Create trade |
| PUT | `/api/trades/:id` | Update trade |
| DELETE | `/api/trades/:id` | Delete trade |
| POST | `/api/trades/import` | Bulk import trades |
| POST | `/api/trades/roll` | Roll trade (atomic close + create) |
| GET | `/api/stats` | Aggregated statistics (`?accountId=X`) |
| GET | `/api/positions` | List stock positions (`?accountId=X`) |
| POST | `/api/positions` | Create position |
| PUT | `/api/positions/:id` | Update/close position |
| DELETE | `/api/positions/:id` | Delete position |
| GET | `/api/positions/summary` | Capital gains summary |
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| PUT | `/api/accounts/:id` | Rename account |
| DELETE | `/api/accounts/:id` | Delete account (409 if has data) |
| GET | `/api/fund-transactions` | List fund transactions (`?accountId=X`) |
| POST | `/api/fund-transactions` | Create fund transaction |
| PUT | `/api/fund-transactions/:id` | Update fund transaction |
| DELETE | `/api/fund-transactions/:id` | Delete fund transaction |
| GET | `/api/stocks` | List manual stocks (`?accountId=X`) |
| POST | `/api/stocks` | Create stock |
| PUT | `/api/stocks/:id` | Update/sell stock |
| DELETE | `/api/stocks/:id` | Delete stock |
| GET | `/api/portfolio/stats` | Portfolio statistics (`?accountId=X`) |
| GET | `/api/portfolio/monthly` | Monthly P/L breakdown (`?accountId=X`) |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings/:key` | Update setting |
| GET | `/api/prices/:ticker` | Get stock price (cached) |
| POST | `/api/prices/batch` | Batch stock prices |

All responses use consistent format:
```json
{
  "success": true,
  "data": {...},
  "meta": { "timestamp": "...", "pagination": {...} }
}
```

## Project Structure

```
server.js                          # Thin entry point
server/
├── index.js                       # createApp() + startServer()
├── db/
│   ├── connection.js              # DB singleton, WAL, pragmas
│   ├── migrations.js              # Schema versioning (10 migrations)
│   └── seed.js                    # Demo data + cost basis fixup
├── middleware/index.js            # CORS, JSON parser, security headers
├── routes/
│   ├── health.js                  # GET /api/health
│   ├── trades.js                  # /api/trades (CRUD + roll + import)
│   ├── stats.js                   # GET /api/stats (recursive CTE)
│   ├── positions.js               # /api/positions (CRUD + summary)
│   ├── prices.js                  # /api/prices (single + batch)
│   ├── settings.js                # /api/settings (GET + PUT)
│   ├── accounts.js                # /api/accounts (CRUD)
│   ├── fundTransactions.js        # /api/fund-transactions (CRUD)
│   ├── stocks.js                  # /api/stocks (CRUD)
│   └── portfolio.js               # /api/portfolio (stats + monthly)
└── utils/
    ├── conversions.js             # toCents, toDollars, toApi converters
    ├── response.js                # apiResponse helper
    └── validation.js              # validate trades, positions, accounts, stocks, fund txns

src/
├── App.jsx                        # Orchestration with tab routing
├── components/
│   ├── ui/                        # Toast, WelcomeModal
│   ├── layout/
│   │   ├── Header.jsx             # App header with account selector
│   │   └── TabBar.jsx             # Options / Portfolio tab switcher
│   ├── dashboard/                 # Dashboard, SummaryCards
│   ├── chart/PnLChart.jsx         # P/L visualization
│   ├── trades/
│   │   ├── TradeTable.jsx         # Trade log with chains
│   │   └── TradeModal.jsx         # Trade create/edit/roll modal
│   ├── positions/PositionsTable.jsx
│   ├── portfolio/
│   │   ├── PortfolioView.jsx      # Portfolio container
│   │   ├── PortfolioDashboard.jsx # KPI cards with subtexts
│   │   ├── MonthlyPLChart.jsx     # Stacked bar chart
│   │   ├── IncomeSourcesChart.jsx # Donut chart
│   │   ├── FundJournal.jsx        # Fund transaction table
│   │   ├── FundTransactionModal.jsx
│   │   ├── StocksTable.jsx        # Stock positions with aggregation
│   │   └── StockModal.jsx         # Stock buy/sell/edit modal
│   └── settings/SettingsModal.jsx
├── hooks/                         # useTheme, useTrades, useTradeForm,
│                                  # useStats, useFilterSort, useCSV,
│                                  # useKeyboardShortcuts, useToast,
│                                  # useAccounts, usePortfolio
├── services/api.js                # API service layer
├── utils/                         # formatters, calculations, constants
└── index.css                      # Tailwind styles
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: Express.js, better-sqlite3
- **Container**: Docker multi-stage build (Node 20 Alpine)

## Building Docker

```bash
# Multi-platform build and push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yomikoye/optionable:0.11.1 \
  -t yomikoye/optionable:latest \
  --push .
```

## License

MIT
