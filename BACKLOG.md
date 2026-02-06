# Backlog

Known issues, improvements, and planned work. Items are pulled from here into version milestones.

---

## Architecture

### server.js is ~1200 lines
DB schema, migrations, business logic, API routes all in one file. Should be split into `db/`, `routes/`, `services/` modules.

### App.jsx is ~900 lines
Still has many `useState` calls and modal/form logic. Could extract more into custom hooks (`useTradeForm`, `useModal`, `useTableState`).

