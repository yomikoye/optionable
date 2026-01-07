# Optionable Development Guide

## Development Workflow Template

### Phase 1: Discovery
- [ ] Understand the request/problem
- [ ] Explore codebase to find relevant files
- [ ] Document current state and what needs to change
- [ ] Identify dependencies and potential impacts
- [ ] Create feature branch: `feature/[name]` or `fix/[name]`
- [ ] Start dev server for live preview

### Phase 2: Planning
- [ ] Break task into smaller steps
- [ ] Prioritize by dependency order (what needs to happen first)
- [ ] Identify risks or blockers
- [ ] Get user approval on approach if needed

### Phase 3: Implementation
- [ ] Work through steps incrementally
- [ ] Test each change before moving on
- [ ] Get user feedback after each major milestone
- [ ] Adjust based on feedback
- [ ] Don't remove existing functionality without asking

### Phase 4: Polish
- [ ] Handle edge cases (empty states, errors, loading)
- [ ] Add user feedback mechanisms if needed (toasts, messages)
- [ ] Clean up code (remove debug logs, unused imports)
- [ ] Verify nothing broke

### Phase 5: Ship
- [ ] Commit with clear, descriptive message
- [ ] Build artifacts if needed (Docker, binaries)
- [ ] Push to registry if needed (Docker Hub, npm)
- [ ] Merge to main
- [ ] Push to GitHub
- [ ] Tag release if applicable

---

## Key Principles
1. **Branch first** - Never work directly on main
2. **Live preview** - Run dev server so user sees changes in real-time
3. **Incremental feedback** - Check in with user after each major change
4. **Don't assume** - Ask before removing or changing existing behavior
5. **Test before commit** - Verify changes work before committing
6. **Ship working code** - Build and test before releasing

---

# Current Task: Architecture Improvements for v1

## Goal
Refactor Optionable to production-grade architecture with clean separation of concerns, optimized database queries, and consistent API design.

## Scope
1. Split monolithic App.jsx (1,533 lines) into components
2. Add server-side pagination to API
3. Standardize API response format
4. Optimize database with SQL aggregations
5. Add database indexes for performance

---

## Task 1: Split Monolithic App.jsx

### Current State
- Single `src/App.jsx` file with 1,533 lines
- Contains: state management, API calls, UI components, utility functions, all mixed together

### Target Structure
```
src/
├── main.jsx                    # Entry point (existing)
├── App.jsx                     # Main layout, routing, global state (~200 lines)
├── components/
│   ├── Dashboard.jsx           # KPI cards grid
│   ├── Chart.jsx               # P/L chart with time selector
│   ├── TradeTable.jsx          # Table with filters, sorting, pagination
│   ├── TradeModal.jsx          # Create/edit trade form
│   ├── SummaryCards.jsx        # Monthly P/L, Ticker P/L, Tips
│   ├── Header.jsx              # App header with actions
│   └── Toast.jsx               # Toast notification component
├── hooks/
│   ├── useTrades.js            # Trade CRUD operations, state
│   ├── useStats.js             # Dashboard statistics
│   └── useTheme.js             # Dark mode toggle
├── api/
│   └── trades.js               # API service layer
├── utils/
│   ├── calculations.js         # calculateMetrics, calculateDTE, etc.
│   ├── formatters.js           # formatCurrency, formatPercent, formatDate
│   └── constants.js            # TRADE_STATUS, TRADES_PER_PAGE, API_URL
└── index.css                   # Styles (existing)
```

### Implementation Order
1. **Extract constants** → `utils/constants.js`
2. **Extract formatters** → `utils/formatters.js`
3. **Extract calculations** → `utils/calculations.js`
4. **Create API service** → `api/trades.js`
5. **Extract Toast** → `components/Toast.jsx`
6. **Extract Header** → `components/Header.jsx`
7. **Extract Dashboard** → `components/Dashboard.jsx`
8. **Extract Chart** → `components/Chart.jsx`
9. **Extract TradeModal** → `components/TradeModal.jsx`
10. **Extract SummaryCards** → `components/SummaryCards.jsx`
11. **Extract TradeTable** → `components/TradeTable.jsx`
12. **Create custom hooks** → `hooks/useTrades.js`, `hooks/useStats.js`, `hooks/useTheme.js`
13. **Refactor App.jsx** to compose components

### Risk Mitigation
- Extract one piece at a time, test after each extraction
- Keep all existing functionality intact
- No UI changes, only code organization

---

## Task 2: Server-Side Pagination

### Current State
- `GET /api/trades` returns ALL trades
- Frontend does pagination with `paginatedTrades` slice

### Target State
- `GET /api/trades?page=1&limit=10&status=Open&sort=openedDate&order=desc`
- Server returns paginated results with metadata

### API Changes
```javascript
// Request
GET /api/trades?page=1&limit=10&status=Open&ticker=META&sort=openedDate&order=desc

// Response
{
  "success": true,
  "data": [...trades],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Implementation
1. Update `GET /api/trades` to accept query params
2. Build dynamic SQL with WHERE, ORDER BY, LIMIT, OFFSET
3. Add COUNT query for total
4. Update frontend to pass filters to API
5. Remove client-side filtering/pagination logic

---

## Task 3: Consistent API Response Format

### Current State (Inconsistent)
```javascript
// GET /api/trades → array directly
[{...}, {...}]

// POST /api/trades → object directly
{id: 1, ticker: "META", ...}

// DELETE /api/trades/:id
{success: true}

// Error responses
{error: "Failed to..."}
```

### Target State (Consistent)
```javascript
// Success response
{
  "success": true,
  "data": {...} | [...],
  "meta": {
    "timestamp": "2026-01-07T19:30:00Z",
    "requestId": "uuid"
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR" | "NOT_FOUND" | "SERVER_ERROR",
    "message": "Human readable message"
  },
  "meta": {
    "timestamp": "2026-01-07T19:30:00Z",
    "requestId": "uuid"
  }
}
```

### Implementation
1. Create response helper functions
2. Add request ID middleware
3. Update all endpoints to use helpers
4. Update frontend to handle new format

---

## Task 4: Database SQL Aggregations

### Current State
- `GET /api/stats` fetches ALL trades, then loops in JavaScript
- O(n) complexity for every stats request

### Target State
- Single SQL query with aggregations
- O(1) complexity

### Current Code (Inefficient)
```javascript
const trades = db.prepare('SELECT * FROM trades').all();
const totalPnL = trades.reduce((acc, t) => acc + calculatePnL(t), 0);
// ... more loops
```

### Target Code (Efficient)
```sql
SELECT
  COUNT(*) as totalTrades,
  COUNT(CASE WHEN status = 'Open' THEN 1 END) as openCount,
  COUNT(CASE WHEN status = 'Expired' THEN 1 END) as expiredCount,
  COUNT(CASE WHEN status = 'Assigned' THEN 1 END) as assignedCount,
  COUNT(CASE WHEN status = 'Rolled' THEN 1 END) as rolledCount,
  SUM((entryPrice - closePrice) * quantity * 100) as totalPnL,
  SUM(entryPrice * quantity * 100) as totalPremium,
  SUM(CASE WHEN status = 'Open' THEN strike * quantity * 100 ELSE 0 END) as capitalAtRisk
FROM trades;
```

### Additional Aggregation Queries
```sql
-- Monthly P/L
SELECT
  strftime('%Y-%m', closedDate) as month,
  SUM((entryPrice - closePrice) * quantity * 100) as pnl
FROM trades
WHERE closedDate IS NOT NULL
GROUP BY month
ORDER BY month DESC;

-- Ticker P/L
SELECT
  ticker,
  SUM((entryPrice - closePrice) * quantity * 100) as pnl
FROM trades
GROUP BY ticker
ORDER BY pnl DESC;

-- Best ticker
SELECT ticker, SUM((entryPrice - closePrice) * quantity * 100) as pnl
FROM trades GROUP BY ticker ORDER BY pnl DESC LIMIT 1;
```

---

## Task 5: Database Indexes

### Current State
- No indexes (full table scans)

### Target State
```sql
-- Status filtering (most common)
CREATE INDEX idx_trades_status ON trades(status);

-- Ticker filtering
CREATE INDEX idx_trades_ticker ON trades(ticker);

-- Date range queries
CREATE INDEX idx_trades_openedDate ON trades(openedDate);
CREATE INDEX idx_trades_expirationDate ON trades(expirationDate);
CREATE INDEX idx_trades_closedDate ON trades(closedDate);

-- Chain lookups
CREATE INDEX idx_trades_parentTradeId ON trades(parentTradeId);

-- Composite for common queries
CREATE INDEX idx_trades_status_openedDate ON trades(status, openedDate);
```

### Implementation
- Add migration to create indexes
- Use IF NOT EXISTS to be idempotent
- Add after table creation in server.js

---

## Implementation Checklist

### Phase 1: Database (Do First - No Breaking Changes) ✅ COMPLETED
- [x] Add database indexes (7 indexes)
- [x] Add SQL aggregation queries for stats
- [x] Add health endpoint `/api/health`
- [x] Test performance improvement

### Phase 2: API Consistency ✅ COMPLETED
- [x] Create response helper functions (`apiResponse.success/error/created`)
- [x] Add request ID middleware
- [x] Update all endpoints to consistent format `{success, data, meta}`
- [x] Update frontend API calls

### Phase 3: Server-Side Pagination ✅ COMPLETED
- [x] Update `GET /api/trades` with query params (page, limit, status, ticker, sortBy, sortDir)
- [x] Build dynamic SQL query builder with WHERE clause
- [x] Add pagination metadata (total, totalPages, hasNext, hasPrev)
- [x] Frontend requests limit=1000 for client-side filtering (backward compatible)
- [ ] Remove client-side pagination logic (deferred - keep for small datasets)

### Phase 4: Frontend Refactor 🔄 IN PROGRESS
- [x] Extract utils (constants, formatters, calculations) → `src/utils/`
- [x] Create API service layer → `src/services/api.js`
- [x] Extract Toast component → `src/components/ui/Toast.jsx`
- [x] Create custom hooks (useToast, useTheme, useTrades) → `src/hooks/`
- [ ] Extract Header component
- [ ] Extract Dashboard component
- [ ] Extract Chart component
- [ ] Extract TradeTable component
- [ ] Extract TradeModal component
- [ ] Extract SummaryCards component
- [ ] Refactor App.jsx to compose

### Phase 5: Testing & Ship
- [ ] Test all functionality
- [ ] Build Docker images
- [ ] Push to registry
- [ ] Tag as v0.5.0

---

## Files to Modify

### Backend
- `server.js` - Add indexes, aggregations, pagination, consistent responses

### Frontend (New Files)
- `src/api/trades.js`
- `src/utils/constants.js`
- `src/utils/formatters.js`
- `src/utils/calculations.js`
- `src/hooks/useTrades.js`
- `src/hooks/useStats.js`
- `src/hooks/useTheme.js`
- `src/components/Toast.jsx`
- `src/components/Header.jsx`
- `src/components/Dashboard.jsx`
- `src/components/Chart.jsx`
- `src/components/TradeTable.jsx`
- `src/components/TradeModal.jsx`
- `src/components/SummaryCards.jsx`

### Frontend (Modified)
- `src/App.jsx` - Reduced to ~200 lines, composing components

---

## Progress Summary

### Completed (Phases 1-3 + Partial Phase 4)

**Backend Changes (server.js):**
- 7 database indexes for performance
- SQL aggregations for /api/stats (single query vs multiple loops)
- Health endpoint /api/health with database status
- Consistent API response format `{success, data, meta}`
- Request ID middleware
- Server-side pagination with query params (page, limit, status, ticker, sortBy, sortDir)

**Frontend Modularization:**
- `src/utils/constants.js` - API_URL, TRADES_PER_PAGE, STATUS, TRADE_TYPE
- `src/utils/formatters.js` - formatDate, formatDateShort, formatCurrency, formatPercent
- `src/utils/calculations.js` - calculateDTE, calculateDaysHeld, calculateMetrics
- `src/services/api.js` - tradesApi, statsApi, healthApi service layer
- `src/hooks/useToast.js` - Toast notification hook
- `src/hooks/useTheme.js` - Dark mode toggle hook
- `src/hooks/useTrades.js` - Trade CRUD operations hook
- `src/components/ui/Toast.jsx` - Toast notification component

**App.jsx:**
- Now imports from modular utils instead of inline definitions
- Uses extracted Toast component
- Reduced from 1533 lines to ~1330 lines (still has room for more extraction)

### Remaining (Phase 4 continued + Phase 5)
- Extract remaining components (Header, Dashboard, Chart, TradeTable, TradeModal, SummaryCards)
- Full App.jsx refactor to compose components
- Build and ship v0.5.0

---

## Next Action
Continue Phase 4: Extract remaining components or proceed to Phase 5: Testing & Ship
