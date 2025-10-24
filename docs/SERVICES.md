# Services & Libraries (src/lib)

This file summarizes the core server-side services and libraries, where to find them and their responsibilities.

- `src/lib/prisma.ts`
  - Exports the Prisma client instance. All DB access should go through this client. Prefer typed queries and minimal SELECT fields for API responses.

- `src/lib/nextAuth.ts` / `src/lib/auth.ts`
  - NextAuth configuration and helper `auth()` used by route handlers to get session information.

- `src/lib/api.ts`
  - Helper functions: `requireRole`, `noStoreJson`, `getActorId`.
  - Extended to enforce global role checks; see `src/lib/rbac/shops.ts` for shop-scoped checks.

- `src/lib/jumia.ts`
  - OIDC token helper and `jumiaFetch` wrapper (caches access tokens in-memory). Extended with `fetchOrdersForShop` and `fetchPayoutsForShop` that return normalized payloads via `src/lib/connectors/normalize.ts`.
  - Important: prefer per-shop credentials stored in `Shop.credentialsEncrypted` when present (DB lookup), but fall back to env vars for global credentials.

- `src/lib/connectors/*`
  - `normalize.ts`: NormalizedOrder type and mapping utilities.
  - `kilimall.ts`: Kilimall connector and signed request helper. Add similar connector files when supporting other marketplaces.

- `src/lib/crypto/secure-json.ts`
  - AES-256-GCM encrypt/decrypt helpers for storing `credentialsEncrypted`. Requires `SECURE_JSON_KEY` in env. Do not log decrypted content.

- `src/lib/rbac/shops.ts`
  - Shop-scoped access control. Use `requireShopAccess({ shopId, minRole })` in API routes that accept a `shopId`.

- `src/lib/commissionRecompute.ts`, `profitRecompute.ts`, `returns.ts`, `commissions.ts`
  - Business logic: commission calculation, profit snapshots, return workflows. When modifying these, ensure tests cover penalties and reversal flows.

## Integration patterns
- Normalizer: all connectors must map their payloads to `NormalizedOrder` before upserting to DB.
- Upserts: use `prisma.order.upsert` keyed by (`shopId`, `externalOrderId`) to ensure idempotency.
- Audit: write `ActionLog` entries for all state transitions that affect finances, returns or assignments.
