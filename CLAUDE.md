# Optionable Development Guide

## Project Overview

Wheel Strategy Tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs) with multi-account support and portfolio management. Self-hosted, local-first app with SQLite storage. Only external dependency is optional live stock prices via [stockprices.dev](https://stockprices.dev).

**Current Version:** 0.13.0
**Docker:** `yomikoye/optionable:latest`

---

## Architecture (v0.11.0)

### Backend
```
server.js                        # Thin entry point (~10 lines)
server/
├── index.js                     # createApp() + startServer()
├── db/
│   ├── connection.js            # DB singleton, WAL, pragmas
│   ├── migrations.js            # Schema versioning + 10 migrations
│   └── seed.js                  # Demo data + cost basis fixup
├── middleware/
│   └── index.js                 # cors, json parser, request ID, security headers
├── routes/
│   ├── health.js                # GET /api/health
│   ├── trades.js                # /api/trades (CRUD + roll + import, accountId filter)
│   ├── stats.js                 # GET /api/stats (recursive CTE, accountId filter)
│   ├── positions.js             # /api/positions (CRUD + summary, accountId filter)
│   ├── prices.js                # /api/prices (single + batch)
│   ├── settings.js              # /api/settings (GET + PUT)
│   ├── accounts.js              # /api/accounts (CRUD)
│   ├── fundTransactions.js      # /api/fund-transactions (CRUD)
│   ├── stocks.js                # /api/stocks (CRUD)
│   └── portfolio.js             # /api/portfolio (stats + monthly)
└── utils/
    ├── conversions.js           # toCents, toDollars, tradeToApi, positionToApi, accountToApi, fundTransactionToApi, stockToApi
    ├── response.js              # apiResponse helper
    └── validation.js            # validateTrade, validatePosition, validateAccount, validateFundTransaction, validateStock
```

### Frontend
```
src/
├── App.jsx                      # Orchestration with tab routing
├── components/
│   ├── ui/
│   │   ├── Toast.jsx            # Toast notifications
│   │   └── WelcomeModal.jsx     # First-time user onboarding with wheel strategy guide
│   ├── layout/
│   │   ├── Header.jsx           # App header with account selector, context-aware new button
│   │   └── TabBar.jsx           # Options / Portfolio tab switcher
│   ├── dashboard/
│   │   ├── Dashboard.jsx        # KPI cards (6 metrics)
│   │   └── SummaryCards.jsx     # Monthly P/L, Ticker P/L, Tips
│   ├── chart/PnLChart.jsx       # Cumulative P/L chart
│   ├── trades/
│   │   ├── TradeTable.jsx       # Trade log with chain grouping
│   │   └── TradeModal.jsx       # Trade create/edit/roll modal
│   ├── positions/PositionsTable.jsx  # Stock positions from assignments
│   ├── portfolio/
│   │   ├── PortfolioView.jsx         # Portfolio container
│   │   ├── PortfolioDashboard.jsx    # Portfolio KPI cards with subtexts
│   │   ├── MonthlyPLChart.jsx        # Monthly P/L stacked bar chart
│   │   ├── IncomeSourcesChart.jsx    # Income sources donut chart
│   │   ├── FundJournal.jsx           # Fund transaction table
│   │   ├── FundTransactionModal.jsx  # Fund transaction form
│   │   ├── StocksTable.jsx           # Stock positions with ticker aggregation
│   │   └── StockModal.jsx            # Stock buy/sell/edit modal
│   └── settings/SettingsModal.jsx    # App settings + account management
├── hooks/
│   ├── useToast.js              # Toast notification hook
│   ├── useTheme.js              # Dark mode toggle
│   ├── useTrades.js             # Trade data fetching (accountId filter)
│   ├── useTradeForm.js          # Trade form state + CRUD handlers
│   ├── useStats.js              # Stats, chart data, chain info (accountId filter)
│   ├── useFilterSort.js         # Table filtering, sorting, pagination
│   ├── useCSV.js                # Multi-section CSV import/export
│   ├── useKeyboardShortcuts.js  # Keyboard shortcut handler
│   ├── useAccounts.js           # Account selection + management
│   └── usePortfolio.js          # Portfolio data + CRUD
├── services/api.js              # API service layer (trades, stats, settings, health, accounts, fundTransactions, stocks, portfolio)
├── utils/
│   ├── constants.js             # API_URL, APP_VERSION, TRADES_PER_PAGE, FUND_TRANSACTION_TYPES, TABS
│   ├── formatters.js            # formatCurrency, formatDate, etc.
│   └── calculations.js          # calculateMetrics, calculateDTE
└── index.css                    # Tailwind styles + JetBrains Mono
```

**Backend:** Express + better-sqlite3 (modular `server/` directory)
**Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
**API:** `/api/trades`, `/api/positions`, `/api/stats`, `/api/settings`, `/api/prices`, `/api/health`, `/api/accounts`, `/api/fund-transactions`, `/api/stocks`, `/api/portfolio`

### Database Tables

All prices stored as INTEGER cents (converted at API boundary).

- **trades** — ticker, type (CSP/CC), strike, quantity, delta, entryPrice, closePrice, dates, status, parentTradeId, notes, accountId
- **positions** — ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, salePrice, soldViaTradeId, capitalGainLoss, accountId
- **accounts** — name, createdAt, updatedAt
- **fund_transactions** — accountId, type (deposit/withdrawal/dividend/interest/fee), amount, date, description
- **stocks** — accountId, ticker, shares, costBasis, acquiredDate, soldDate, salePrice, capitalGainLoss, notes
- **price_cache** — ticker, price, change, changePercent (cached from stockprices.dev)
- **settings** — key/value store (live_prices_enabled, confirm_expiry, portfolio_mode_enabled)
- **schema_migrations** — version, applied_at, description (Flyway-style migration tracking)

### Key Files

| File | Purpose |
|------|---------|
| `server.js` | Thin entry point (imports `server/index.js`) |
| `server/index.js` | App creation, startup orchestration |
| `server/db/connection.js` | Database singleton + WAL config |
| `server/db/migrations.js` | Schema versioning (10 migrations) |
| `server/routes/trades.js` | Trade CRUD + roll + import endpoints |
| `server/routes/portfolio.js` | Portfolio stats + monthly breakdown |
| `src/App.jsx` | React orchestration with tab routing |
| `src/hooks/useTradeForm.js` | Trade form state + CRUD handlers |
| `src/hooks/useStats.js` | Stats computation, chart data |
| `src/hooks/useAccounts.js` | Account selection + management |
| `src/hooks/usePortfolio.js` | Portfolio data + CRUD |
| `src/components/trades/TradeModal.jsx` | Trade create/edit/roll modal |
| `src/components/portfolio/StocksTable.jsx` | Stock positions with aggregation |
| `src/utils/calculations.js` | P/L calculations, metrics |
| `Dockerfile` | Multi-stage build for production |
| `docker-compose.yml` | Docker deployment config |

---

## Development Workflow

### Quick Start
```bash
npm install
npm run dev          # Start dev server (frontend + backend)
npm run build        # Build for production
```

### Branching Strategy

- **main** — Stable, tagged releases only. Never commit directly to main.
- **develop** — Integration branch for the next version. All feature branches merge here.
- **feature/task branches** — Each task gets its own branch off `develop` (e.g., `feature/input-validation`, `fix/chain-pnl`).

**Flow:** `feature-branch` → `develop` (for a specific version) → `main` (when version is complete) → tag `vX.Y.Z`

### Release Process

**IMPORTANT:** After completing any feature or bug fix, ask the user if they're ready to bump the version before committing. They may have additional work planned for the current feature.

1. **Ask user:** "Ready to bump version and release?" (they may not be done yet)
2. **Bump version** (after user confirms, on `develop`):
   - `package.json` → update `"version"`
   - `server/routes/health.js` → update fallback version in `/api/health`
   - `src/utils/constants.js` → update `APP_VERSION`
   - `README.md` → update version badge and docker example
   - `CLAUDE.md` → update "Current Version"
3. Commit version bump to `develop`
4. **Update CHANGELOG.md** — Add a new version entry summarizing all changes included in this release
5. Merge `develop` → `main`
6. Tag: `git tag vX.Y.Z && git push --tags`
7. Build & push Docker:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t yomikoye/optionable:X.Y.Z \
     -t yomikoye/optionable:latest \
     --push .
   ```
8. Push to GitHub
9. **Create GitHub release** using `gh` CLI:
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --latest=true --notes "release notes here"
   ```
   - Use the CHANGELOG.md entry for the version as the release notes body
   - Include a Docker pull command at the bottom of the notes
   - Only the newest release should have `--latest=true`

---

## References

- **[CHANGELOG.md](CHANGELOG.md)** — Version history and changes per release
- **[BACKLOG.md](BACKLOG.md)** — Known issues, improvements, and planned work
