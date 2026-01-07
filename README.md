# Optionable

A self-hosted wheel strategy tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs).

![Version](https://img.shields.io/badge/version-0.5.0-blue)
![Docker](https://img.shields.io/badge/docker-yomikoye%2Foptionable-green)
![Platforms](https://img.shields.io/badge/platforms-amd64%20%7C%20arm64-lightgrey)

## Features

- **Dashboard** - Total P/L, premium collected, win rate, capital at risk
- **P/L Chart** - Cumulative profit/loss visualization with time period filters
- **Trade Log** - Full trade history with sorting, filtering, pagination
- **Roll Tracking** - Link rolled trades to track full position chains
- **Analytics** - Monthly and per-ticker P/L breakdowns
- **Auto Calculations** - P/L, ROI, annualized ROI, DTE, collateral
- **CSV Import/Export** - Backup and restore your trade data
- **Dark Mode** - Toggle between light and dark themes
- **Keyboard Shortcuts** - N (new trade), D (dark mode), Esc (close modal)
- **Self-hosted** - SQLite database, full data ownership

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

### Homelab Deployment

The `docker-compose.yml` is configured for Traefik reverse proxy:

```yaml
services:
  optionable:
    image: yomikoye/optionable:latest
    volumes:
      - /path/to/data:/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.optionable.rule=Host(`optionable.yourdomain.com`)"
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check with version |
| GET | `/api/trades` | List trades (supports `?page=1&limit=10&status=Open&ticker=META`) |
| GET | `/api/trades/:id` | Get single trade |
| POST | `/api/trades` | Create trade |
| PUT | `/api/trades/:id` | Update trade |
| DELETE | `/api/trades/:id` | Delete trade |
| POST | `/api/trades/import` | Bulk import trades |
| GET | `/api/stats` | Aggregated statistics |

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
│   ├── ui/Toast.jsx           # Notifications
│   ├── layout/Header.jsx      # App header
│   ├── dashboard/
│   │   ├── Dashboard.jsx      # KPI cards
│   │   └── SummaryCards.jsx   # Monthly/ticker stats
│   ├── chart/PnLChart.jsx     # P/L visualization
│   └── trades/TradeTable.jsx  # Trade log
├── hooks/                     # useToast, useTheme, useTrades
├── services/api.js            # API client
└── utils/                     # formatters, calculations, constants
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **Backend**: Express.js, better-sqlite3
- **Container**: Docker multi-stage build (Node 20 Alpine)

## Building Docker

```bash
# Multi-platform build and push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yomikoye/optionable:0.5.0 \
  -t yomikoye/optionable:latest \
  --push .
```

## License

MIT
