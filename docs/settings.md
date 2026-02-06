# Settings

Open settings by clicking the **Settings** icon in the header or pressing **S**.

## Live Stock Prices

**Default:** Enabled

When enabled, the app fetches real-time stock prices from [stockprices.dev](https://stockprices.dev) (free, no API key required). These prices are used to calculate unrealized gains on open stock positions.

When disabled, the app uses only cached prices from previous fetches. If no cached price exists, current price shows as "--".

Prices are cached in the database so they persist across restarts.

## Confirm Expiry

**Default:** Enabled

When enabled, a confirmation dialog appears before marking a trade as expired. This prevents accidental expiry clicks.

When disabled, clicking **Expire** immediately closes the trade at $0.

## Storage

Settings are stored in the SQLite database (`settings` table) and persist across sessions and container restarts.

| Setting | Database Key | Default |
|---------|-------------|---------|
| Live Stock Prices | `live_prices_enabled` | `true` |
| Confirm Expiry | `confirm_expire_enabled` | `true` |

Two preferences are stored client-side in localStorage:

| Preference | Key | Default |
|------------|-----|---------|
| Theme (light/dark) | `theme` | `light` |
| Welcome dismissed | `optionable_welcome_dismissed` | Not set (shows on first visit) |
