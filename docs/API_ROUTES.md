# API Routes Map (summary)

This file lists the main API route groups and their responsibilities. For detailed signatures, inspect the route handler files under `src/app/api`.

Note: All routes that accept `shopId` must call `requireShopAccess(...)` (server-side) to verify the actor has the right per-shop role. Admins bypass shop checks.

## Key endpoints (grouped)

- /api/shops
  - POST /api/shops — Admin create shop (name, platform, credentialsEncrypted). Test connection.
  - GET /api/shops/:id — Get shop details (Admin/Supervisor depending on assignment).
  - PATCH /api/shops/:id — Update shop (credentials, active).
  - POST /api/shops/:id/assign — Assign user to shop with `roleAtShop`.

- /api/sync
  - POST /api/sync/orders — Loop all shops, call connectors (Jumia/Kilimall), normalize and upsert orders/items.
  - POST /api/sync/payouts — Loop shops, fetch payouts, create `Reconciliation` + `Discrepancy` records.
  - POST /api/sync/returns — Fetch returns where available or infer; used for syncs.

- /api/orders
  - GET /api/orders?shopId&status — list orders (shop-filtered by RBAC).
  - POST /api/orders/:id/process — Supervisor/Admin processes order transitions (confirm/pack/ship/cancel). Uses `requireShopAccess(minRole=SUPERVISOR)`.

- /api/returns
  - POST /api/returns/:id/pick — Attendant/Supervisor marks return PICKED and stores evidence URLs (upload handled by storage service).
  - POST /api/returns/:id/evidence — Upload or register evidence for a return.
  - GET /api/returns/waiting-pickup — list returns awaiting pickup (shop-scoped).

- /api/products
  - POST /api/products/:productId/cost — Supervisor/Admin records `ProductCost` with `source` (MANUAL or LEARNED). Used for penalties and profit snapshots.

- /api/commission
  - POST /api/commission/recompute — Admin triggers recompute for current period.

- /api/reconciliation
  - POST /api/reconciliation/run — Admin runs reconciliation for given shop/day, creates `Reconciliation` and `Discrepancy` records.
  - GET /api/reconciliation?shopId&day — returns reconciliation rows and discrepancy table.

- Other helpers / existing files
  - /api/commissions/ledger — ledger queries and exports.
  - /api/commissions/recompute — existing recompute endpoints extended to consider penalty lines.
  - /api/settings/jumia — manage global Jumia endpoints/overrides.
  - /api/health — health check endpoint.
  - /api/catalog/products-count — lightweight counts for catalog products with Redis caching.
    - GET params: `shopId` or `all=true`, `exact=true|false` (default false), optional `ttlMs` (default 30m), `size`, `timeMs`.
    - Response: `{ total, approx, byStatus, byQcStatus, updatedAt }` and header `x-cache: hit|miss`.

## Implementation notes
- All syncs must be idempotent: upsert by (`shopId`, `externalOrderId`).
- Any operation that mutates financial state (commissions, settlement rows, penalties) must create `ActionLog` entries for auditability.
- Avoid returning raw `credentialsEncrypted` in API responses; only return masked metadata and `lastTestedAt` or similar.
