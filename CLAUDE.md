# Optionable Development Guide

## Project Overview
Wheel Strategy Tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs).

**Current Version:** 0.6.0
**Docker:** `yomikoye/optionable:latest`

---

## Architecture (v0.6.0)

```
src/
├── App.jsx                     # Main app (~950 lines, includes TradeModal)
├── components/
│   ├── ui/
│   │   ├── Toast.jsx           # Toast notifications
│   │   └── WelcomeModal.jsx    # First-time user onboarding
│   ├── layout/Header.jsx       # App header with actions
│   ├── dashboard/
│   │   ├── Dashboard.jsx       # KPI cards (6 metrics)
│   │   └── SummaryCards.jsx    # Monthly P/L, Ticker P/L, Tips
│   ├── chart/PnLChart.jsx      # Cumulative P/L chart
│   ├── trades/TradeTable.jsx   # Trade log with chain grouping
│   ├── positions/PositionsTable.jsx  # Stock positions tracking
│   └── settings/SettingsModal.jsx    # App settings (live prices toggle)
├── hooks/
│   ├── useToast.js             # Toast notification hook
│   ├── useTheme.js             # Dark mode toggle
│   └── useTrades.js            # Trade CRUD operations
├── services/api.js             # API service layer
├── utils/
│   ├── constants.js            # API_URL, TRADES_PER_PAGE (5)
│   ├── formatters.js           # formatCurrency, formatDate, etc.
│   └── calculations.js         # calculateMetrics, calculateDTE
└── index.css                   # Tailwind styles + JetBrains Mono
```

**Backend:** Express + better-sqlite3
**API:** `/api/trades`, `/api/positions`, `/api/stats`, `/api/settings`, `/api/prices`, `/api/health`

---

## Database Schema

### trades
```sql
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'CSP' or 'CC'
  strike REAL NOT NULL,
  quantity INTEGER DEFAULT 1,
  delta REAL,
  entryPrice REAL NOT NULL,
  closePrice REAL DEFAULT 0,
  openedDate TEXT NOT NULL,
  expirationDate TEXT NOT NULL,
  closedDate TEXT,
  status TEXT DEFAULT 'Open',      -- Open, Expired, Assigned, Closed, Rolled
  parentTradeId INTEGER,           -- Links rolled/chained trades
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### positions
```sql
CREATE TABLE positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  shares INTEGER NOT NULL,
  costBasis REAL NOT NULL,
  acquiredDate TEXT NOT NULL,
  acquiredFromTradeId INTEGER,     -- CSP trade that was assigned
  soldDate TEXT,
  salePrice REAL,
  soldViaTradeId INTEGER,          -- CC trade that was assigned
  capitalGainLoss REAL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### price_cache
```sql
CREATE TABLE price_cache (
  ticker TEXT PRIMARY KEY,
  price REAL NOT NULL,
  change REAL,
  changePercent REAL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### settings
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Development Workflow

### Quick Start
```bash
npm run dev          # Start dev server (frontend + backend)
npm run build        # Build for production
```

### Docker Build
```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yomikoye/optionable:VERSION \
  -t yomikoye/optionable:latest \
  --push .
```

### Release Process
1. Update version in `package.json`
2. Update version fallback in `server.js`
3. Update version badges in README.md
4. Commit changes
5. Build & push Docker
6. Push to GitHub

---

## Features (v0.6.0)

### Dashboard KPIs (synced with chart time filter)
1. **Premium Collected** - Net premium from closed trades
2. **Avg ROI** - Average return on collateral
3. **Win Rate** - Percentage of profitable chains
4. **Stock Gains** - Realized capital gains from positions
5. **Total P/L** - Premiums + Stock Gains combined
6. **Deployed Capital** - Collateral locked in open trades

### Trade Chains
- Rolled trades linked via `parentTradeId`
- CSP→CC sequences auto-linked when CC opened on assigned shares
- Collapsible chain view in trade table
- Chain P/L aggregated and displayed

### Keyboard Shortcuts
- `N` - New trade
- `P` - Positions modal
- `S` - Settings modal
- `H` - Help/welcome modal
- `D` - Toggle dark mode
- `Esc` - Close any modal

### Seed Data (fresh install)
1. AAPL CSP - Expired (simple put)
2. MSFT CC - Expired (simple call)
3. META CSP chain - Rolled to new CSP
4. NVDA full wheel - CSP assigned → CC assigned ($1,000 realized gain)

---

## v0.6.0 Implementation Status

- [x] Add positions table migration
- [x] Add price_cache table
- [x] Add settings table (live_prices_enabled)
- [x] Create positions API endpoints
- [x] Create /api/prices/:ticker endpoint (proxy with caching)
- [x] Auto-create position on CSP assignment
- [x] Auto-close position on CC assignment
- [x] Add positions UI (PositionsTable)
- [x] Add settings UI (SettingsModal with toggle)
- [x] Update dashboard with capital gains metrics
- [x] Add manual position close flow
- [x] Update stats aggregations
- [x] Trade chain grouping in UI
- [x] Dashboard/chart time period sync
- [x] Welcome modal for first-time users
- [x] Keyboard shortcuts (N, P, S, H, D, Esc)
- [x] Fix delete with FK constraints
- [x] Pagination (5 chains per page)

---

## Future Ideas

- **Brokerage Import** - Import trades from TD Ameritrade, Schwab CSV
- **Target Allocation** - Set target capital per ticker, track usage
- **Expiration Calendar** - Visual calendar of upcoming expirations
- **Alerts** - Notify when DTE < 7 or position at risk
- **Multi-account** - Track multiple brokerage accounts separately
- **Tax Reporting** - Generate Schedule D data for tax filing

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server.js` | Express API, SQLite database, all endpoints, seed data |
| `src/App.jsx` | Main React app, state management, TradeModal |
| `src/components/trades/TradeTable.jsx` | Trade log with chain grouping |
| `src/components/positions/PositionsTable.jsx` | Stock positions tracking |
| `src/components/settings/SettingsModal.jsx` | Settings with live prices toggle |
| `src/components/ui/WelcomeModal.jsx` | First-time user onboarding |
| `src/utils/calculations.js` | P/L calculations, metrics |
| `Dockerfile` | Multi-stage build for production |
| `docker-compose.yml` | Homelab deployment config |
