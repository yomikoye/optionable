# Changelog

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
