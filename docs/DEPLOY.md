# Deploy & Run Instructions

This file aggregates the commands and environment variables needed to run and deploy Betechops after the multi-marketplace upgrade.

## Required environment variables (minimum)
- DATABASE_URL — Postgres connection string
- NEXTAUTH_SECRET — secret for NextAuth
- SECURE_JSON_KEY — secret used to encrypt/decrypt `Shop.credentialsEncrypted`
- FILE_STORAGE_BUCKET, FILE_STORAGE_REGION, FILE_STORAGE_KEY, FILE_STORAGE_SECRET — for file uploads (return evidence)

Optional/global integration fallbacks (prefer per-shop credentials stored in DB)
- base_url (preferred canonical vendor API base for Jumia)
- (legacy) JUMIA_API_BASE
- OIDC_ISSUER or JUMIA_OIDC_ISSUER
- OIDC_CLIENT_ID or JUMIA_CLIENT_ID
- OIDC_CLIENT_SECRET or JUMIA_CLIENT_SECRET
- OIDC_REFRESH_TOKEN or JUMIA_REFRESH_TOKEN
- KILIMALL_API_BASE

## Development

1. Install dependencies & generate Prisma client

```pwsh
npm ci
npm run prisma:generate
```

2. Apply migrations (local)

```pwsh
npx prisma migrate dev --name init
```

3. Run dev server

```pwsh
npm run dev
```

## Production / CI

1. In CI, run:

```pwsh
npm ci --production=false
npm run prisma:generate
npm run lint
npm run build
```

2. Deploy to host (Vercel recommended):
  - Ensure env vars are set on the deployment provider.
  - Run `npx prisma migrate deploy` during your release pipeline to apply migrations.

## Scheduled Jobs
- Vercel: use Cron Jobs / Scheduled Functions or use a worker host (e.g., a small server in a container) to run the syncs and nightly jobs.
- Jobs to run:
  - sync-orders (every 10–15 mins)
  - sync-payouts (daily)
  - returns-sla (nightly)
  - commission-calc (nightly)
  - price-learner (nightly)

## CI smoke checks (recommended)
- `npm run prisma:generate`
- `npm run lint`
- `curl $BASE_URL/api/health` (expect 200)
- `curl $BASE_URL/api/sync/orders?simulate=true` (expect normalized results, no secrets)

## Notes
- Migration file `prisma/migrations/20251024_multi_marketplace_upgrade/migration.sql` is additive and backfills `ReturnCase.dueAt`.
- Review the migration for `gen_random_uuid()` usage; adjust to `uuid_generate_v4()` if your Postgres does not have `pgcrypto`.
