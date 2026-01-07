# Optionable Development Guide

## Project Overview
Wheel Strategy Tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs).

**Current Version:** 0.5.0
**Docker:** `yomikoye/optionable:latest`

---

## Architecture (v0.5.0)

```
src/
├── App.jsx                     # Main app (~950 lines, includes TradeModal)
├── components/
│   ├── ui/Toast.jsx            # Toast notifications
│   ├── layout/Header.jsx       # App header with actions
│   ├── dashboard/
│   │   ├── Dashboard.jsx       # KPI cards grid
│   │   └── SummaryCards.jsx    # Monthly P/L, Ticker P/L, Tips
│   ├── chart/PnLChart.jsx      # Cumulative P/L chart
│   └── trades/TradeTable.jsx   # Trade log with sorting/filtering
├── hooks/
│   ├── useToast.js             # Toast notification hook
│   ├── useTheme.js             # Dark mode toggle
│   └── useTrades.js            # Trade CRUD operations
├── services/api.js             # API service layer
├── utils/
│   ├── constants.js            # API_URL, TRADES_PER_PAGE
│   ├── formatters.js           # formatCurrency, formatDate, etc.
│   └── calculations.js         # calculateMetrics, calculateDTE
└── index.css                   # Tailwind styles
```

**Backend:** Express + better-sqlite3
**API:** `/api/trades`, `/api/stats`, `/api/health`

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
2. Update version fallback in `server.js` (line ~205)
3. Commit changes
4. Build & push Docker
5. Push to GitHub

---

## Roadmap

### v0.6.0 - Capital Gain/Loss Tracking (GitHub Issue #2)

**Problem:**
When assigned on a CSP, you acquire shares. When those shares are sold (via CC assignment or manual sale), there's a capital gain/loss that isn't currently tracked.

**Example:**
```
1. Sell CSP AAPL $150 strike → collect $3 premium → ASSIGNED
   → Acquired 100 shares at $150 (cost basis: $15,000)

2. Sell CC AAPL $160 strike → collect $2 premium → ASSIGNED
   → Sold 100 shares at $160 (proceeds: $16,000)

Currently tracked:  $300 + $200 = $500 (premium only)
Missing:            $16,000 - $15,000 = $1,000 (stock gain)
Total real P/L:     $1,500
```

**Design:**

#### Database Schema Addition
```sql
-- Track share positions acquired through assignments
CREATE TABLE positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  shares INTEGER NOT NULL,           -- Number of shares (100 per contract)
  costBasis REAL NOT NULL,           -- Price per share when acquired
  acquiredDate TEXT NOT NULL,        -- Date of CSP assignment
  acquiredFromTradeId INTEGER,       -- Link to the CSP trade that was assigned
  soldDate TEXT,                     -- Date shares were sold (NULL if still held)
  salePrice REAL,                    -- Price per share when sold
  soldViaTradeId INTEGER,            -- Link to CC trade if assigned, NULL if manual sale
  capitalGainLoss REAL,              -- (salePrice - costBasis) * shares
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_positions_ticker ON positions(ticker);
CREATE INDEX idx_positions_soldDate ON positions(soldDate);
```

#### Workflow
1. **CSP Assignment** → Auto-create position record with cost basis = strike price
2. **CC Assignment** → Match against open position (FIFO), record sale price = strike, calculate gain/loss
3. **Manual Sale** → UI to close position at custom price

#### API Endpoints
```
GET    /api/positions              # List all positions (open and closed)
GET    /api/positions?status=open  # Open positions only
POST   /api/positions              # Manual position entry
PUT    /api/positions/:id          # Close position (manual sale)
GET    /api/positions/summary      # Total unrealized/realized gains
```

#### UI Changes
1. New "Positions" tab or section showing:
   - Open positions (ticker, shares, cost basis, current value, unrealized G/L)
   - Closed positions (ticker, shares, cost basis, sale price, realized G/L)
2. Dashboard additions:
   - Total Realized Capital Gains
   - Total Unrealized Capital Gains
   - Combined P/L (Premium + Capital Gains)
3. When marking trade as "Assigned":
   - CSP → Prompt to confirm share acquisition
   - CC → Prompt to select which lot to sell (if multiple)

#### Implementation Steps
- [ ] Add positions table migration
- [ ] Create positions API endpoints
- [ ] Auto-create position on CSP assignment
- [ ] Auto-close position on CC assignment (FIFO)
- [ ] Add positions UI (list, summary)
- [ ] Update dashboard with capital gains metrics
- [ ] Add manual position close flow
- [ ] Update stats aggregations

---

### Future Ideas

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
| `server.js` | Express API, SQLite database, all endpoints |
| `src/App.jsx` | Main React app, state management, TradeModal |
| `src/components/trades/TradeTable.jsx` | Trade log with sorting/filtering |
| `src/utils/calculations.js` | P/L calculations, metrics |
| `Dockerfile` | Multi-stage build for production |
| `docker-compose.yml` | Homelab deployment config |
