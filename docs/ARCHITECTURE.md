# Betechops — Architecture & Upgrade Summary

This document summarizes the multi-marketplace upgrade (Jumia + Kilimall) done on branch-3 and the intended design for Shop-scoped RBAC, connectors, reconciliation, SLAs, learned prices and commission-ledger handling.

## High-level architecture
- Next.js 15 (App Router) — UI + API Route handlers under `src/app/*`.
- Prisma + PostgreSQL — schema in `prisma/schema.prisma`, migrations in `prisma/migrations`.
- Connectors: `src/lib/connectors/*` provide marketplace-specific fetchers + a normalizer that maps external payloads to a single `NormalizedOrder` shape.
- Secrets: shop credentials stored encrypted in `Shop.credentialsEncrypted` as JSON; encryption helpers in `src/lib/crypto/secure-json.ts`.
- RBAC: global role (`User.role`) + per-shop assignment `UserShop` with `roleAtShop` enforced by `src/lib/rbac/shops.ts`.
- Background jobs: scheduled syncs (orders/payouts/returns), SLA checks, price-learner, reconciliation and commission recompute.

## Key changes made (summary)
- Prisma: added enums (Platform, ShopRoleAtShop, ReturnStatus, PriceSource, DiscrepancyType, DiscrepancyStatus) and models (`UserShop`, `ProductCost`, `CommissionLedger`, `Reconciliation`, `Discrepancy`).
- `ReturnCase` extended with `dueAt` and `pickedAt`; migration backfills `dueAt = createdAt + 7 days`.
- Added connectors: `src/lib/connectors/normalize.ts` and `src/lib/connectors/kilimall.ts`. `src/lib/jumia.ts` extended to return normalized orders.
- Added secure JSON encrypt/decrypt at `src/lib/crypto/secure-json.ts` (AES-256-GCM, env var `SECURE_JSON_KEY`).
- Added shop-scoped RBAC helper `src/lib/rbac/shops.ts`.

## Data model notes
- The schema changes are additive and compatible with existing tables. Existing string `ReturnCase.status` is preserved; new fields `dueAt` and `pickedAt` are used for SLA tracking.
- `Shop.credentialsEncrypted` holds platform-specific credentials encrypted by the server; never log decrypted content.

## Runbook — migrations & deploy
1. Ensure `SECURE_JSON_KEY` is set in environment/secrets (64-hex or passphrase).
2. Run Prisma generate and migrations on the DB:

```pwsh
npm ci
npm run prisma:generate
npx prisma migrate deploy --preview-feature
```

3. Verify `ReturnCase.dueAt` backfill ran (see `prisma/migrations/20251024_multi_marketplace_upgrade/migration.sql`).

## Jobs & schedules (recommended)
- sync-orders: every 10–15 min — upsert normalized orders by (shopId, externalOrderId).
- sync-payouts: daily — upsert settlement/payout rows and run reconciliation for the previous day.
- returns-sla: nightly — mark overdue `ReturnCase` (now > dueAt) as `OVERDUE`, append penalty line to `CommissionLedger`.
- commission-calc: nightly — recompute commission ledgers after penalties applied.
- price-learner: nightly — learn `ProductCost` as `LEARNED` when there are ≥3 consistent manual entries.

## Security
- Do not log decrypted credentials.
- Use `SECURE_JSON_KEY` in secret manager.
- Store file uploads (return evidence) in S3-compatible storage; save only signed URLs/paths in DB.

## Next steps & TODO
- Implement API routes for shops, sync endpoints and reconciliation (stubs created as part of the upgrade plan).
- Add UI modals for shop create/edit and credential test connection.
- Implement scheduled functions/cron jobs in production environment.

## Where to look in the repo
- Prisma schema: `prisma/schema.prisma`
- Migration: `prisma/migrations/20251024_multi_marketplace_upgrade/migration.sql`
- Connectors: `src/lib/connectors/*`
- Crypto helpers: `src/lib/crypto/secure-json.ts`
- RBAC helper: `src/lib/rbac/shops.ts`
