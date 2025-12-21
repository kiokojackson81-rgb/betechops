Recompute marketing commission ledger (wrapper)
==============================================

This CommonJS wrapper avoids ts-node/ESM resolution cycles and provides a simple CLI to recompute an attendant's marketing commission ledger.

Prereqs
- Repo set up locally and dependencies installed: `pnpm install`
- `DATABASE_URL` points to the DB you want to modify (e.g. Neon production DB).

Usage
- Run for the current trading period (defaults to `brendah@betech.co.ke` if no email provided):
  ```powershell
  $env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
  node scripts/recompute-wrapper.js brendah@betech.co.ke
  ```
- Run for a specific date (ISO format) to recompute the period containing that date:
  ```powershell
  $env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
  node scripts/recompute-wrapper.js brendah@betech.co.ke 2025-10-01
  ```

Notes
- The wrapper:
  - Looks up the user by email.
  - Summarizes marketing entries + daily reports for the target period.
  - Applies the "profit-only" logic (commission is computed only when profit > 0; keeps 5% fallback for small totals).
  - Upserts the `commissionLedger` row for the period (idempotent).
- Verify by checking the script output and admin endpoints.
