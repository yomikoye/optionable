# Optionable

A self-hosted wheel strategy tracker for Cash Secured Puts (CSPs) and Covered Calls (CCs).

![Dashboard](https://img.shields.io/badge/Stack-React%20%2B%20SQLite-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-green)

## Features

- 📊 **Dashboard** - Total P/L, win rate, assignments at a glance
- 📝 **Trade Log** - Track all your CSP and CC trades
- 📈 **Analytics** - Monthly and per-ticker P/L summaries
- 🔄 **Auto Calculations** - P/L, ROI, collateral metrics
- 💾 **Persistent Storage** - SQLite database with Docker volume support
- 🏠 **Self-hosted** - Full data ownership, no cloud dependencies

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server (runs both backend and frontend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

### Docker (Local Testing)

```bash
# Build and run locally
docker compose -f docker-compose.local.yml up --build

# Access at http://localhost:8080
```

### Docker (Homelab Deployment)

The main `docker-compose.yml` is configured for homelab deployment with:
- Traefik reverse proxy integration
- Persistent volume at `/mnt/shared/portainer/optionable`
- External `homelab-network`

```bash
# Pull and deploy
docker compose up -d
```

## Project Structure

```
optionable/
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind styles
├── server.js            # Express API + SQLite
├── Dockerfile           # Multi-stage build
├── docker-compose.yml   # Homelab deployment
└── docker-compose.local.yml  # Local testing
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trades` | List all trades |
| GET | `/api/trades/:id` | Get single trade |
| POST | `/api/trades` | Create new trade |
| PUT | `/api/trades/:id` | Update trade |
| DELETE | `/api/trades/:id` | Delete trade |
| GET | `/api/stats` | Get aggregated stats |

## Data Storage

SQLite database is stored at:
- **Local dev**: `./data/optionable.db`
- **Docker**: `/data/optionable.db` (mount a volume to persist)

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Container**: Docker multi-stage build

## Building the Docker Image

```bash
# Build locally
docker build -t yomikoye/optionable:latest .

# Push to registry (if using Docker Hub)
docker push yomikoye/optionable:latest
```

## License

MIT
