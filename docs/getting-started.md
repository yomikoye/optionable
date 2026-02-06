# Getting Started

## Installation

### Docker (Recommended)

Pull and run with a single command:

```bash
docker run -d -p 8080:8080 -v optionable-data:/data yomikoye/optionable:latest
```

Or use Docker Compose:

```bash
docker compose up -d
```

The app will be available at **http://localhost:8080**.

### Local Development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `DATA_DIR` | `./data` (local) or `/data` (Docker) | Database file location |
| `NODE_ENV` | `production` | Environment mode |

The SQLite database (`optionable.db`) is automatically created in `DATA_DIR` on first launch.

## First Launch

On a fresh install, Optionable loads four demo trades to help you get familiar:

1. **AAPL CSP** - Expired worthless ($280 profit)
2. **MSFT CC** - Expired worthless ($350 profit)
3. **META CSP** - Rolled to a new strike (chain example)
4. **NVDA Full Wheel** - CSP assigned, then CC assigned ($1,000 capital gain)

These demonstrate the key trade types: simple puts/calls, rolling, and the full wheel cycle.

A **Welcome Guide** modal appears on first visit explaining features and keyboard shortcuts. You can reopen it anytime by pressing **H**.

## Quick Workflow

1. Click **New Trade** (or press **N**) to log your first trade
2. Fill in the ticker, strike, dates, and premium
3. When a trade expires, click **Expire** to close it at $0
4. If assigned on a CSP, change status to **Assigned** and the app creates a stock position automatically
5. Click **Sell CC** on an assigned CSP to open a covered call on those shares
6. Use **Roll** to close and reopen a position at a new strike

See [Trades](trades.md) for full details on each flow.
