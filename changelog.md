# Changelog — Session (2025-12-28)

Summary of changes made this session:

- Feature: Activity CSV importer
  - Auto-detects Activity-style exports (headers like "Activity Date", "Instrument", "Trans Code").
  - Uses Activity Date as openedDate; ignores Process Date and Settle Date.
  - Cleans numeric fields (handles $, commas, parentheses) and normalizes descriptions.

- Parsing & mapping helpers added
  - Added parseCSV, normalizeKey, parseDateString, cleanNumber, normalizeDescription, parseInstrument.
  - Instrument parsing extracts ticker, strike, option type and expiration when available.

- STO → BTC (roll) detection
  - Matches STO Put rows to BTC Put rows with the same normalized description (BTC date >= STO).
  - Matching is now stricter: if strike and/or expiration exist on both rows they must match.
  - When matched, the STO trade is marked as `Rolled` and closedDate/closePrice are set from the BTC.

- Import workflow / UI
  - Added import-format selector (Auto / Optionable / Activity) next to Import.
  - Added editable Import Preview modal (edit/add/remove rows) before uploading.
  - Confirm uploads parsed rows to POST /api/trades/import; cancel resets the file input.

- Other
  - File input is now referenced and reset on cancel/confirm.
  - Preview shows up to 250 rows and highlights Rolled rows.
  - Primary file changed: `src/App.jsx` (CSV parsing, mapping, preview UI and helpers).
  - Configuration: TZ updated to `America/Chicago` in `docker-compose.yml` and `docker-compose.local.yml`.

Notes / next steps:
- Unit tests for parsing and strict STO→BTC matching can be added on request.
- Option to make strictness configurable or to further improve instrument parsing also possible.