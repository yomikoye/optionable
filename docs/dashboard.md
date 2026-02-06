# Dashboard

The dashboard shows key performance metrics and charts for your trading activity.

## KPI Cards

Six metrics displayed in a responsive grid at the top of the page:

| KPI | Description |
|-----|-------------|
| Premium Collected | Net premium from all closed trades |
| Avg ROI | Average return on collateral across closed trades |
| Win Rate | Percentage of resolved chains that were profitable |
| Stock Gains | Realized capital gains from closed stock positions |
| Total P/L | Premiums + Stock Gains combined |
| Deployed Capital | Cash collateral locked in open CSP trades (CCs excluded since they use owned shares) |

All KPIs sync with the selected chart time period.

## P/L Chart

A cumulative P/L area chart showing your profit/loss over time.

- **X-axis:** Trade close dates
- **Y-axis:** Cumulative P/L in dollars
- **Color:** Green when total P/L is positive, red when negative
- **Hover:** Shows ticker, date, individual trade P/L, and running total

### Time Period Filters

Tabs above the chart: **1M**, **3M**, **6M**, **YTD**, **All**

Changing the period filters both the chart data and the dashboard KPIs. Only completed trades (non-Open) are included.

## Summary Cards

Three cards below the trade table:

### Monthly P/L
A table of P/L broken down by month, newest first. Only includes closed trades.

### Ticker P/L
A table of P/L broken down by ticker, sorted by highest P/L first. Only includes closed trades.

### Wheel Strategy Tips
Reminders for the wheel strategy:
- Sell CSPs on red days
- Sell CCs on green days
- Avoid earnings weeks if conservative
- Don't wheel stocks you don't want to own
