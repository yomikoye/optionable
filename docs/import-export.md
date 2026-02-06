# Import & Export

## Exporting Trades

Click **Export** in the header to download all trades as a CSV file.

- **Filename:** `optionable_trades_YYYY-MM-DD.csv`
- **Contents:** All trades, unfiltered
- **Format:** Standard CSV with headers

### Exported Columns

id, ticker, type, strike, quantity, delta, entryPrice, closePrice, openedDate, expirationDate, closedDate, status, parentTradeId

## Importing Trades

Click **Import** in the header and select a CSV file.

### Required Columns

These must be present in the CSV header:

- `ticker`
- `type` (CSP or CC)
- `strike`
- `entryPrice`
- `openedDate`
- `expirationDate`
- `status`

### Optional Columns

These default to sensible values if missing:

| Column | Default |
|--------|---------|
| `quantity` | 1 |
| `delta` | null |
| `closePrice` | 0 |
| `closedDate` | null |
| `parentTradeId` | null |

### Import Behavior

- Trades are imported in bulk as a single batch
- Tickers are automatically converted to uppercase
- The import adds to existing data (does not replace)
- After import, the trade list and stats refresh automatically

### Tips

- Use export to create a backup before importing
- The exported CSV format matches the expected import format, so you can round-trip data
- If importing from another source, make sure date formats match (YYYY-MM-DD)
