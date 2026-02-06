# Backlog

Known issues, improvements, and planned work. Items are pulled from here into version milestones.

---

## Bugs

### Chain P/L vs ROI mismatch
Chain total P/L shows all trades, but ROI only shows root trade's ROI. Misleading when chain has multiple rolls at different strikes.

### DTE on chains shows root trade
Shows DTE of root trade (already expired) instead of the last trade in the chain.

### CSV export missing notes
`notes` field is not included in exports, so data is lost on export/import cycle.

### Batch price endpoint ignores settings
`/api/prices/batch` doesn't check the `live_prices_enabled` toggle.

### Roll save is not atomic
If the original trade updates to "Rolled" but the new trade creation fails, data is left in an inconsistent state.

---

## Security

### No API authentication
All endpoints are public, CORS allows any origin. Should at minimum require an API key header.

### No input validation on server
Numeric fields (strike, price, quantity, delta) aren't validated. Dates aren't checked for logic (expiration > opened). Status/type enums aren't validated against a whitelist.

### sortDirection in SQL not restricted
Lowercased but not restricted to `ASC`/`DESC` only.

### No request size limit
`express.json()` has no `limit` set.

### External API calls have no timeout
Fetch to stockprices.dev could hang indefinitely.

---

## Performance

### N+1 query in stats
Loads ALL trades into memory, then `.find()` in a loop to walk chains. Should use recursive CTEs.

### Sort recalculates metrics O(n log n) times
`calculateMetrics()` called inside sort comparator instead of pre-computing once.

### Chain building is O(n²)
`TradeTable` uses `.find()` in a loop instead of building a lookup Map.

### Batch price fetches are sequential
Should use `Promise.all()` for concurrent requests.

### No SQLite WAL mode
Would improve concurrent read/write performance.

---

## Architecture

### server.js is ~1100 lines
DB schema, migrations, business logic, API routes all in one file. Should be split into `db/`, `routes/`, `services/` modules.

### App.jsx is ~1100 lines
17 `useState` calls, all modal/form/filter/sort logic crammed in. Should extract into custom hooks (`useTradeForm`, `useModal`, `useTableState`).

### useTrades hook exists but is never used
App.jsx duplicates the same API calls instead.

### Theme management duplicated
`useTheme` hook exists but App.jsx has its own separate dark mode state.

---

## Accessibility

### Modals lack ARIA attributes
No `role="dialog"`, `aria-modal`, `aria-labelledby`, no focus trap.

### Color-only indicators
P/L and status rely solely on color with no text/icon fallback for colorblind users.

### Toast has no aria-live
Screen readers won't announce notifications.

### Icon buttons missing aria-label

---

## Data Integrity

### No foreign key CASCADE
Deletes are handled manually, risk of orphaned records.

### Prices stored as REAL
Floating-point precision issues with money. Should use INTEGER (cents).

### No check constraints
Nothing prevents negative strikes, zero quantity, or dates out of order.

### Migration strategy is fragile
Checks column existence by parsing SQL strings instead of schema versioning.

---

## UX

### CSV import uses string.split(',')
Breaks on quoted fields with commas. Should use a proper parser like papaparse.

### Success alert on import uses alert()
Inconsistent with rest of app which uses toast notifications.
