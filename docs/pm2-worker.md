# Jumia Sync Worker (PM2)

This worker keeps your database in sync with Jumia pending orders so the Admin UI stays fresh.

## Prerequisites

- Node.js 20+
- PostgreSQL and `DATABASE_URL`
- Jumia OAuth creds (client id/refresh token) in your env or DB credentials table
- PM2 installed globally: `npm i -g pm2`

## Run locally

```bash
npm run worker:jumia-sync
```

Environment variables (set before running or via `.env`):

- `DATABASE_URL` – Prisma connection string
- `JUMIA_CLIENT_ID`, `JUMIA_REFRESH_TOKEN` – or configure via DB `apiCredential`
- `JUMIA_WORKER_INTERVAL_MS` – optional polling interval (default 15000ms)

## Run with PM2

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
- Logs: `pm2 logs jumia-sync-worker`.
