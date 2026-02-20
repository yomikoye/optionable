# Changelog

## v0.13.0

### New Features
- **Database export** — Download a full backup of the SQLite database from Settings
- **Import duplicate detection** — Re-importing the same CSV skips existing trades, fund transactions, and stocks instead of creating duplicates; skipped counts shown in toast notification

### Settings UI
- **Alphabetical order** — Settings sections reordered: Confirm Expiry, Dark Mode, Paginate Trades, Portfolio Mode, Show Help on Startup
- **Consistent icon colors** — All setting icons now use the same indigo/blue color
- **Removed Live Prices section** — Cleaned up the Live Stock Prices toggle and info box
- **Beautified Accounts section** — Accounts moved to bottom with centered header, card-style rows, and indigo-themed action buttons
- **Export Database section** — Added with divider lines above and below for visual separation
- **Blue Done button** — Footer button now matches the app's indigo theme

### Bug Fixes
- **Orphaned position cleanup** — Startup cleanup now catches positions referencing deleted trades (stale foreign keys), fixing phantom capital gains in Portfolio stats after demo trade deletion
- **Portfolio stats refresh** — Deleting trades now immediately refreshes Portfolio data without requiring a page reload
- **Chain child row alignment** — Edit/Delete buttons in expanded chain rows now right-aligned with text labels, matching the root row style
- **Dark mode DTE colors** — Fixed missing dark mode color variants on chain child row DTE values
- **Dev server restart loop** — Fixed `--watch-path` to only watch backend files, preventing server restarts on frontend edits

---

## v0.12.0

### Configurable Pagination
- **Trades per page setting** — New option in Settings modal to choose how many trade chains display per page (5, 10, 25, 50, or Show All)
- **Persistent preference** — Setting stored in database and synced across sessions
- **DB migration v11** — Added `trades_per_page` key to settings table

### Trade Table UI
- **Smart expiry column** — Shows closed/rolled date for completed trades instead of expiry date
- **Centered column layout** — Standardized column widths with consistent alignment
- **Vertical column dividers** — Added subtle column separators for improved readability
- **Simplified status styling** — Cleaner status column with consistent text colors across root and child chain rows

### Bug Fixes
- **Account picker in modals** — Fixed account picker in all modals (Trade, Fund Transaction, Stock) when viewing "All Accounts"

---

## v0.11.1

### Bug Fixes
- **Fund Journal Add button** — No longer greyed out when viewing "All Accounts"; shows account picker in modal instead
- **FundTransactionModal stale state** — Fixed form showing previous transaction data when reopening (replaced useState initializer with useEffect reset)
- **Account picker in modals** — All three modals (Trade, Fund Transaction, Stock) now include an account dropdown when creating from "All Accounts" view
- **TradeModal submit validation** — Submit button properly disabled until account is selected when account picker is shown
- **modalAccountId reset** — Prevented stale account selection from carrying over between modal opens
- **Clean payloads** — Removed leaked empty `accountId` from form data when not using account picker

### Improvements
- **Consistent label styling** — Account picker labels now match across all modals (uppercase, semibold, with asterisk)
- **Trade ticker placeholder** — Changed default placeholder from "SOXL" to "GOOG"

## v0.11.0

### Multi-Account Support
- **Accounts CRUD** — Create, rename, and delete brokerage accounts
- **Account filtering** — All trades, positions, stats, and portfolio data filter by selected account
- **Account selector** — Dropdown in header to switch accounts or view "All Accounts"
- **Account management** — Create/rename/delete accounts in Settings
- **DB migration v8** — `accounts` table + `accountId` column on trades and positions with backfill to default account

### Portfolio Mode
- **Portfolio toggle** — Enable in Settings to show Options/Portfolio tab switcher
- **Fund journal** — Track deposits, withdrawals, dividends, interest, and fees with full CRUD
- **Manual stock tracking** — Buy/sell stocks with cost basis, P/L calculation, and notes
- **Portfolio dashboard** — KPI cards: Deposited, Total P/L, Rate of Return, Options P/L, Stock Gains, Income
- **KPI subtexts** — Each card clarifies data source (e.g. "From closed positions", "X closed trades")
- **Monthly P/L chart** — Stacked bar chart breaking down returns by source (options, stocks, income)
- **Income sources chart** — Donut chart showing income breakdown by category
- **Context-aware header** — "New Trade" button becomes "Buy Stock" on Portfolio tab
- **DB migrations v9-v10** — `fund_transactions` and `stocks` tables

### UI Improvements
- **StocksTable redesign** — Ticker aggregation with expandable lots, TradeTable-style header with filter tabs, labeled action buttons (Sell/Edit/Delete)
- **StockModal redesign** — Matches TradeModal style: backdrop blur, uppercase labels, sell context box with P/L preview, total cost display
- **Dark mode in Settings** — Moved from header toggle into Settings modal
- **Help on startup toggle** — New setting to control whether welcome guide shows on app launch
- **Welcome modal update** — 4-step wheel strategy walkthrough, updated keyboard shortcuts, portfolio mode mention
- **Settings button restyled** — Matches Export/Import button style (icon + text label)

### CSV Import/Export
- **Multi-section format** — Export includes `[TRADES]`, `[FUND_TRANSACTIONS]`, and `[STOCKS]` sections
- **Backward compatible** — Old single-section CSVs still import as trades-only
- **Custom CSV parser** — Replaced PapaParse dependency with built-in parser

### Bug Fixes
- **Portfolio cash balance** — Fixed calculation to only include fund transactions (removed options P/L and stock gains from cash)
- **Options P/L** — Now only counts realized trades (excludes Open trades where closePrice=0)
- **Income sources chart** — Fixed 10000% display bug caused by Recharts `percent` prop collision
- **Stock edit modal** — Fixed form not pre-filling when editing (useEffect reset instead of stale useState initializer)
- **Header cleanup** — Removed orphaned Positions button reference

---

## v0.10.0

### Architecture
- **Modular backend** — Split `server.js` (1607 lines) into 13 focused modules under `server/` (db, middleware, routes, utils)
- **Modular frontend** — Split `App.jsx` (1085 lines) into 6 hooks + TradeModal component (~200 lines remaining)
- **Thin entry point** — `server.js` is now a ~10 line wrapper that imports `server/index.js`
- **Hook extraction** — `useTradeForm`, `useStats`, `useFilterSort`, `useCSV`, `useKeyboardShortcuts` extracted from App.jsx
- **TradeModal extraction** — Trade create/edit/roll modal extracted to `src/components/trades/TradeModal.jsx`
- **API service layer** — Added `tradesApi.roll()` and `settingsApi` to `src/services/api.js`

### Security
- **Security headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **CSP in production** — Content-Security-Policy header restricts resource loading
- **CORS hardening** — Restricted to same-origin in production
- **Info disclosure fix** — Health endpoint no longer leaks DB error details
- **Parameterized seed queries** — Replaced `db.exec()` template literals with `db.prepare().run()` in seed data
- **X-Powered-By disabled** — Express fingerprint header removed

### Bug Fixes
- **CSV import chain linking** — Import now preserves `id` field so parentTradeId chain links (rolls, CSP→CC) survive round-trip export/import
- **CSV import notes** — Notes field now included in import mapping (was exported but dropped on import)

---

## v0.9.0

### Data Integrity & Validation
- **Input validation** — Server-side validation for trades and positions (types, ranges, dates)
- **Data integrity** — CHECK constraints and ON DELETE CASCADE/SET NULL at database level
- **Prices as INTEGER** — Store prices in cents to avoid floating point precision issues

### Performance
- **SQLite WAL mode** — Better concurrent read/write performance
- **Batch price optimization** — Parallel price fetches with Promise.all()
- **N+1 query fix** — Recursive CTE for chain P/L calculations in stats endpoint
- **Sort pre-compute** — Map-based caching eliminates repeated calculations during sort
- **Chain building optimization** — O(1) Map lookups instead of O(n) array find()

### Architecture
- **Schema versioning** — Flyway-style numbered migrations replace fragile column checks
- **Hooks cleanup** — App.jsx now uses useTheme and useTrades hooks

---

## v0.8.0

- **Stock gains cleanup** — Deleting trades now properly deletes associated positions and capital gains
- **Orphaned positions cleanup** — Startup migration removes positions with no linked trades
- **Trade notes** — Added optional notes field to trades (stored in database, editable in modal)
- **Expiry confirmation** — Confirmation dialog before marking trades as expired
- **Confirm expiry setting** — Toggle in Settings to enable/disable expiry confirmation
- **Ticker alignment fix** — Trade table rows now align consistently (invisible chevron placeholder for single trades)

## v0.7.0

- **Cost basis fix** — CSP assignment now calculates cost basis as `strike - premium`
- **Migration** — Auto-fix existing positions with incorrect cost basis
- **Deployed capital fix** — Only counts CSPs (CCs use owned shares, not cash)
- **Sell CC button fix** — Now shows after CC expires to sell another CC
- **Version display** — App version shown in header

## v0.6.0

- Add positions table migration
- Add price_cache table
- Add settings table (live_prices_enabled)
- Create positions API endpoints
- Create /api/prices/:ticker endpoint (proxy with caching)
- Auto-create position on CSP assignment
- Auto-close position on CC assignment
- Add positions UI (PositionsTable)
- Add settings UI (SettingsModal with toggle)
- Update dashboard with capital gains metrics
- Add manual position close flow
- Update stats aggregations
- Trade chain grouping in UI
- Dashboard/chart time period sync
- Welcome modal for first-time users
- Keyboard shortcuts (N, P, S, H, D, Esc)
- Fix delete with FK constraints
- Pagination (5 chains per page)
