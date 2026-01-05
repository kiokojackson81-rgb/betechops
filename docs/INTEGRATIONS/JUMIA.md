# Jumia integration blueprint

This document summarises the Jumia integration, required env vars, runbook, and Copilot seed comments for implementing the full redesign.

## Goals
- Securely store credentials (env or DB), never log secrets.
- Rate-limit requests to Jumia (≈4 rps, ~200 rpm) with a shared queue and retries.
- Persistent token cache (Redis) optional, with memory fallback.
- Unified nextToken paginator used across orders, products and feeds.
- Multi-shop orchestration and safe fan-out.
- Feeds chunking + polling, reconciliation, metrics and alerts.

## Required env variables
- base_url (preferred canonical vendor API base, e.g. `https://vendor-api.jumia.com`)
- OIDC_TOKEN_URL or JUMIA_OIDC_TOKEN_URL
- OIDC_CLIENT_ID or JUMIA_CLIENT_ID
- OIDC_REFRESH_TOKEN or JUMIA_REFRESH_TOKEN
- OIDC_CLIENT_SECRET or JUMIA_CLIENT_SECRET (optional)
- JUMIA_AUTH_SCHEME (optional, defaults to `Bearer`)
- REDIS_URL (optional, for persistent token cache)

## Quick runbook
1. Configure credentials via env or Admin UI `/api/settings/jumia` (credentials are stored encrypted in DB).
2. Verify connectivity via `/api/debug/jumia` and `/api/debug/oidc`.
3. If running multi-instance, set `REDIS_URL` to enable persistent token cache.
4. Ensure Prometheus (or APM) is configured to scrape metrics emitted by the app.

## Weekly sales autopopulation
1. Ensure the Jumia credentials used by `syncOnlineMarketplaceData` are available either via the `JUMIA_*` env vars or by creating an `ApiCredential` row scoped to `GLOBAL` or the individual marketplace account.
2. Run `npm run weekly-sales:sync`. The script executes `syncOnlineMarketplaceData({ lookbackDays: 70 })` to fetch payout statements into `MarketplacePayoutWeek` and then runs the backfill logic that upserts `WeeklySale` rows for the last four weeks (configurable via `WEEKLY_SALES_BACKFILL_LOOKBACK_DAYS`).
3. Watch the logs (`sync-and-backfill-weekly-sales` prefix) for confirmation that statements populated and `WeeklySale` rows were created/updated.
4. When automating deployments, call this script after credential rotation so the weekly sales view reflects the newest statements without manual entry.

## Copilot seed comments
Add the provided `// TODO(copilot): ...` comments at the top of the target files (`src/lib/oidc.ts`, `src/lib/jumia.ts`, `src/lib/connectors/normalize.ts`, and new modules like `src/lib/jumia.feeds.ts`, `src/jobs/*`). Then start typing the function names — Copilot or an engineer can finish the implementation.

## Observability & alerts
- Token refresh failures > 3 in 5m -> PagerDuty/Slack
- HTTP 429/5xx spike alert
- Reconciliation mismatch thresholds -> email/alert

## Next recommended implementation steps
1. Add p-limited queue and retry policy in `jumiaFetch` (rate limit + exponential backoff).
2. Implement persistent token cache in `getJumiaAccessToken()` guarded by `REDIS_URL`.
3. Implement nextToken iterator used by `getOrders`, `getCatalogProducts`, feeds polling.
4. Implement jobs: `syncOrders`, `fulfillOrder`, `syncInventory`, `reconcile`.
5. Add metrics and structured logger.

---
This file was generated to capture the integration redesign plan and to seed Copilot-enabled implementation steps.
