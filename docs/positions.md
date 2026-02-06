# Positions

Stock positions track shares acquired through CSP assignments and sold through CC assignments.

## Opening the Positions Modal

Click **Positions** in the header or press **P**.

## How Positions Are Created

Positions are created **automatically** when a CSP trade is marked as "Assigned":

- **Shares:** Quantity x 100
- **Cost Basis:** Strike price - Entry premium received (per share)
- **Acquired Date:** The trade's closed date (or today if not set)

You don't need to manually create positions. Just change a CSP's status to "Assigned" and the position appears.

## How Positions Are Closed

Positions close **automatically** when a CC trade on the same ticker is marked as "Assigned". The app uses FIFO (first in, first out) to select the oldest open position.

When closed:
- **Sale Price:** The CC's strike price
- **Capital Gain/Loss:** (Sale Price - Cost Basis) x Shares

You can also manually close a position from the Positions modal.

## Summary Cards

The modal shows four summary metrics at the top:

| Metric | Description |
|--------|-------------|
| Realized G/L | Total capital gains from closed positions |
| Unrealized G/L | Current value vs cost basis on open positions (requires live prices) |
| Open Positions | Count of positions you currently hold |
| Closed Positions | Count of positions that have been sold |

## Positions Table

| Column | Description |
|--------|-------------|
| Ticker | Symbol + acquired date |
| Shares | Number of shares held |
| Cost Basis | Per-share cost (strike - premium) |
| Current | Live market price (if enabled) |
| G/L | Gain or loss with directional icon |
| Status | Open or Closed badge |

### Filtering

Use the tabs: **All**, **Open**, or **Closed**.

### Refreshing Prices

Click **Refresh Prices** to fetch the latest stock prices for all open positions. This requires live prices to be enabled in [Settings](settings.md).

## Unrealized Gains

For open positions, unrealized G/L is calculated as:

```
(Current Price - Cost Basis) x Shares
```

If live prices are disabled or unavailable, the current price column shows "--".
