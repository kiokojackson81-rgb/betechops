# Jumia Sync Worker (PM2)

This worker keeps your database in sync with Jumia pending orders so the Admin UI stays fresh.

# PM2 worker

This repository ships a Jumia sync worker you can run continuously for sub‑5s freshness.

## TL;DR (Linux/Windows)

1) Build the worker bundle

```
npm run build:worker
```

2) Start under PM2 using the provided ecosystem file

```
pm2 start ecosystem.worker.config.cjs
pm2 save
Alternatively, use the local, gitignored config that already embeds your DATABASE_URL:

```
pm2 start ecosystem.worker.config.local.cjs
pm2 save
```

```

3) Verify logs

```
pm2 logs jumia-sync --lines 200
```

You should see a startup line like:

```
[jumia-sync-worker] starting, interval(ms)= 2000, incrementalEvery(ms)= 2000, incrementalLookback(days)= 3, deepEvery(ms)= 900000, pendingEvery(ms)= 30000, ...
```

## Tuning

- `JUMIA_WORKER_INTERVAL_MS`: tick interval (default 5000). Set to `2000` for ~2s.
- `JUMIA_WORKER_INCREMENTAL_EVERY_MS`: how often to run incremental refresh (default = `INTERVAL_MS`).
- `JUMIA_WORKER_PENDING_EVERY_MS`: how often to run the heavy 7‑day pending sweep (default = `INTERVAL_MS`). Use a higher value like `30000` to reduce vendor load while keeping incremental fast.

Environment to set (via PM2 env or system env):

- `DATABASE_URL` (Prisma)
- `REDIS_URL` (optional)
- Vendor auth (client IDs, refresh tokens if used in your setup)

Worker cadence envs (already included in `ecosystem.worker.config.cjs`):

- `JUMIA_WORKER_INTERVAL_MS` (e.g., `2000`)
- `JUMIA_WORKER_INCREMENTAL_EVERY_MS` (e.g., `2000`)
- `JUMIA_WORKER_INCREMENTAL_LOOKBACK_DAYS` (e.g., `3`)
- `JUMIA_WORKER_INCREMENTAL_DEEP_EVERY_MS` (e.g., `900000` for 15 minutes)
- `JUMIA_WORKER_PENDING_EVERY_MS` (e.g., `30000`)
- `JUMIA_SYNC_LOOKBACK_DAYS` (e.g., `120` for deep backfills)

On Windows, install PM2 globally and use PowerShell:

```
npm i -g pm2
npm run build:worker
pm2 start ecosystem.worker.config.cjs
pm2 save
```

To rebuild, reload, and verify cadence settings after config changes:

```powershell
# From the PM2 host (rebuild bundle, reload with updated env, then check logs)
pwsh ./scripts/pm2-reload-and-verify.ps1 -Name jumia-sync -Lines 120 -Build

# Manual (if you prefer commands):
npm run build:worker
pm2 reload jumia-sync --update-env
pm2 logs jumia-sync --lines 120
```

PM2 auto-start on Windows can be handled with pm2-windows-startup or a scheduled task.


- Node.js 20+
- PostgreSQL and `DATABASE_URL`
- Jumia OAuth creds (client id/refresh token) in your env or DB credentials table
- PM2 installed globally: `npm i -g pm2`

## Run locally

```bash
npm run worker:jumia-sync
```

### Windows (PowerShell) quick overrides

macOS/Linux often show inline env like `JUMIA_WORKER_INTERVAL_MS=5000 npm run worker:jumia-sync`, which doesn't work in PowerShell. Use these instead:

```powershell
# Set temporary env vars for this PowerShell session
$env:JUMIA_WORKER_INTERVAL_MS = "5000"
$env:JUMIA_WORKER_INCREMENTAL_EVERY_MS = "5000"  # optional; defaults to the interval

# Start the worker
npm run worker:jumia-sync

# When finished, clear the overrides (optional)
Remove-Item Env:JUMIA_WORKER_INTERVAL_MS -ErrorAction SilentlyContinue
Remove-Item Env:JUMIA_WORKER_INCREMENTAL_EVERY_MS -ErrorAction SilentlyContinue
```

Alternatively, put these in a `.env` file and omit the PowerShell exports.

Environment variables (set before running or via `.env`):

- `JUMIA_WORKER_INCREMENTAL_EVERY_MS` – optional cadence for the incremental sync pass (defaults to same as interval)

## Run with PM2

# macOS/Linux
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 status
pm2 logs jumia-sync-worker
```

To override env per host, you can copy `ecosystem.config.js` and replace the `env` values, or use `pm2 set pm2:...`.

## How it works

- `scripts/jumia-sync-worker.ts` calls `syncAllAccountsPendingOrders()` on a loop.
- The sync fetches PENDING orders for each configured Jumia shop and upserts into Prisma tables.
- Admin UI reads from DB and updates as SSE/refresh events fire.

## Troubleshooting

- If you see auth errors, verify tokens and that the VM/network can reach Jumia vendor API.
- Rate limits: the sync uses a small concurrency cap; increase interval if you hit vendor limits.
- Logs: `pm2 logs jumia-sync`.
