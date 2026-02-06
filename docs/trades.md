# Trades

## Creating a Trade

Click **New Trade** in the header or press **N**.

### Form Fields

| Field | Required | Description |
|-------|----------|-------------|
| Ticker | Yes | Stock symbol (auto-capitalized) |
| Type | Yes | CSP (Cash-Secured Put) or CC (Covered Call) |
| Strike | Yes | Strike price (step $0.50) |
| Quantity | No | Number of contracts (default: 1) |
| Delta | No | Probability of assignment (0.00 - 1.00) |
| Opened Date | Yes | Date the trade was opened (default: today) |
| Expiration Date | Yes | Option expiration date |
| Closed Date | No | Date the trade was closed |
| Entry Premium | Yes | Premium received per share |
| Close Cost | No | Cost to buy back the option |
| Notes | No | Free-text notes about the trade |
| Status | Yes | Open, Expired, Assigned, or Closed |

The form shows a live total: `Entry Premium x Quantity x 100`.

## Editing a Trade

Click **Edit** on any trade row. The modal opens with all fields pre-populated. Submit with **Update Trade**.

## Duplicating a Trade

Click **Duplicate** to create a new trade pre-filled with the same ticker, strike, type, and quantity. Dates and premium are cleared for you to fill in.

## Expiring a Trade

Click **Expire** on an open trade. This sets close price to $0 and status to "Expired" (the ideal outcome for a sold option).

If **Confirm Expiry** is enabled in [Settings](settings.md), a confirmation dialog appears first. You can disable this in settings.

## Deleting a Trade

Click **Delete** on any trade. A confirmation prompt appears. Deleting a trade also:

- Unlinks any child trades (rolls) from the chain
- Deletes stock positions created by CSP assignment
- Resets positions closed by CC assignment back to open

## Rolling a Trade

Rolling lets you close an existing position and open a new one at a different strike or expiration, linked as a chain.

1. Click **Roll** on an open trade
2. Enter the **Close Cost** for the original position (the cost to buy it back)
3. Fill in the new strike, expiration, and premium
4. The modal shows the **net credit/debit** for the roll
5. Click **Roll & Create New**

This automatically:
- Closes the original trade with status "Rolled"
- Creates a new trade linked to the original via `parentTradeId`

## Opening a Covered Call on Assigned Shares

When a CSP is assigned, a **Sell CC** button appears on that trade. Clicking it opens the new trade modal with:

- Ticker and quantity pre-filled
- Type set to CC
- The new CC is linked to the CSP as part of the same chain

## Trade Chains

Related trades are grouped into chains:

- A **root trade** is any trade without a parent
- **Child trades** are rolls or CCs linked via `parentTradeId`
- Chains display with an expandable chevron and an amber badge showing the trade count
- Child rows are indented and labeled "Roll #1", "Roll #2", etc.
- Chain P/L is the sum of all trades in the chain

## Trade Table

### Columns

| Column | Sortable | Notes |
|--------|----------|-------|
| Ticker | Yes | Expand chevron for chains |
| Type | No | CSP or CC badge |
| Strike | Yes | |
| Qty | No | Number of contracts |
| Delta | No | Shows "---" if not set |
| Opened | Yes | Short date format |
| Expiry | Yes | Short date format |
| DTE | No | Days to expiration (Open trades only). Red if 3 or fewer days, orange if 7 or fewer |
| P/L | Yes | Green = profit, red = loss. Shows "chain total" for multi-trade chains |
| ROI | Yes | Return on collateral |
| Status | No | Color-coded badge |
| Actions | No | Edit, Delete, Roll, Expire, Sell CC (contextual) |

### Filtering

Use the tabs above the table:

- **All** - All trades
- **Open** - Only open trades
- **Closed** - All non-open trades (Expired, Assigned, Rolled, Closed)

Click **Clear Filters** to reset filters and sorting.

### Sorting

Click any sortable column header to cycle through ascending, descending, and no sort.

### Pagination

Trades are paginated by chains (not individual trades). Navigation appears at the bottom of the table.

## CSV Import / Export

### Exporting

Click **Export** in the header. A CSV file named `optionable_trades_YYYY-MM-DD.csv` downloads automatically containing all trades.

### Importing

Click **Import** in the header and select a CSV file.

**Required columns:** ticker, type, strike, entryPrice, openedDate, expirationDate, status

**Optional columns:** quantity, delta, closePrice, closedDate, parentTradeId

Missing optional fields use sensible defaults (quantity = 1, closePrice = 0, etc.).
