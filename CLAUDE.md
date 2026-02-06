# Optionable Development Guide

## Project Overview

Wheel Strategy Tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs). Self-hosted, local-first app with SQLite storage. Only external dependency is optional live stock prices via [stockprices.dev](https://stockprices.dev).

**Current Version:** 0.9.0
**Docker:** `yomikoye/optionable:latest`

---

## Architecture (v0.9.0)

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
│   └── settings/SettingsModal.jsx    # App settings (live prices, confirm expiry)
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

**Backend:** Express + better-sqlite3 (single `server.js`)
**Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
**API:** `/api/trades`, `/api/positions`, `/api/stats`, `/api/settings`, `/api/prices`, `/api/health`

### Database Tables

All prices stored as INTEGER cents (converted at API boundary).

- **trades** — ticker, type (CSP/CC), strike, quantity, delta, entryPrice, closePrice, dates, status, parentTradeId, notes
- **positions** — ticker, shares, costBasis, acquiredDate, acquiredFromTradeId, salePrice, soldViaTradeId, capitalGainLoss
- **price_cache** — ticker, price, change, changePercent (cached from stockprices.dev)
- **settings** — key/value store (live_prices_enabled, confirm_expiry)
- **schema_migrations** — version, applied_at, description (Flyway-style migration tracking)

### Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express API, SQLite database, all endpoints, seed data |
| `src/App.jsx` | Main React app, state management, TradeModal |
| `src/components/trades/TradeTable.jsx` | Trade log with chain grouping |
| `src/components/positions/PositionsTable.jsx` | Stock positions tracking |
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
   - `server.js` → update fallback version in `/api/health`
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

---

## References

- **[CHANGELOG.md](CHANGELOG.md)** — Version history and changes per release
- **[BACKLOG.md](BACKLOG.md)** — Known issues, improvements, and planned work
