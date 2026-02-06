# Optionable

A self-hosted wheel strategy tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs).

![Version](https://img.shields.io/badge/version-0.8.0-blue)
![Docker](https://img.shields.io/badge/docker-yomikoye%2Foptionable-green)
![Platforms](https://img.shields.io/badge/platforms-amd64%20%7C%20arm64-lightgrey)

## Philosophy

Optionable is designed to be **fast, fully local, and self-contained**. Everything runs on your own hardware with no accounts to create, no cloud sync, and no brokerage connections required. Your trade data lives in a local SQLite database that you own completely.

The only external dependency is optional live stock prices via [stockprices.dev](https://stockprices.dev), used for unrealized P/L on open positions. This can be disabled in settings, making the app fully offline-capable.

## Features

- **Dashboard** - Premium collected, ROI, win rate, stock gains, total P/L, deployed capital
- **Capital Gains Tracking** - Track stock positions from CSP assignments through CC sales
- **P/L Chart** - Cumulative profit/loss visualization with time period filters (1M, 3M, 6M, YTD, All)
- **Trade Log** - Full trade history with chain grouping, sorting, filtering, pagination
- **Trade Chains** - Rolled trades and CSP→CC sequences grouped together
- **Positions Table** - Track open and closed stock positions with realized/unrealized gains
- **Live Stock Prices** - Optional real-time prices for unrealized G/L (via [stockprices.dev](https://stockprices.dev), can be disabled)
- **Roll Tracking** - Link rolled trades to track full position chains
- **Analytics** - Monthly and per-ticker P/L breakdowns
- **Auto Calculations** - P/L, ROI, annualized ROI, DTE, collateral
- **CSV Import/Export** - Backup and restore your trade data
- **Dark Mode** - Light mode default, toggle to dark
- **Keyboard Shortcuts** - N (new), P (positions), S (settings), H (help), D (dark mode), Esc (close)
- **Welcome Guide** - First-time user onboarding with feature overview
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
| GET | `/api/trades` | List trades (supports `?page=1&limit=10&status=Open&ticker=META`) |
| GET | `/api/trades/:id` | Get single trade |
| POST | `/api/trades` | Create trade |
| PUT | `/api/trades/:id` | Update trade |
| DELETE | `/api/trades/:id` | Delete trade (handles FK constraints) |
| POST | `/api/trades/import` | Bulk import trades |
| GET | `/api/stats` | Aggregated statistics |
| GET | `/api/positions` | List stock positions |
| POST | `/api/positions` | Create position |
| PUT | `/api/positions/:id` | Update/close position |
| DELETE | `/api/positions/:id` | Delete position |
| GET | `/api/positions/summary` | Capital gains summary |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings/:key` | Update setting |
| GET | `/api/prices/:ticker` | Get stock price (cached) |

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
src/
├── App.jsx                    # Main app, state management, TradeModal
├── components/
│   ├── ui/
│   │   ├── Toast.jsx          # Notifications
│   │   └── WelcomeModal.jsx   # First-time user guide
│   ├── layout/Header.jsx      # App header
│   ├── dashboard/
│   │   ├── Dashboard.jsx      # KPI cards
│   │   └── SummaryCards.jsx   # Monthly/ticker stats
│   ├── chart/PnLChart.jsx     # P/L visualization
│   ├── trades/TradeTable.jsx  # Trade log with chains
│   ├── positions/PositionsTable.jsx  # Stock positions
│   └── settings/SettingsModal.jsx    # App settings
├── utils/                     # formatters, calculations, constants
└── index.css                  # Tailwind styles
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: Express.js, better-sqlite3
- **Container**: Docker multi-stage build (Node 20 Alpine)

## Building Docker

```bash
# Multi-platform build and push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yomikoye/optionable:0.8.0 \
  -t yomikoye/optionable:latest \
  --push .
```

## License

MIT
