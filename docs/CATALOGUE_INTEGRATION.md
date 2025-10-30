# Catalogue / Product API Integration Blueprint

This blueprint explains how BetechOps integrates with the Jumia Vendor API for catalog/products. It is written for external implementers who need to understand the moving parts, how to call things, configure credentials, and troubleshoot.

---

## 1) High-level overview

- Goal: read and operate on the Jumia catalogue (products, variations, stock, prices) and compute simple KPIs (totals, status breakdowns).
- Platform: Next.js App Router (server components) + Prisma/Postgres + optional Redis cache.
- Auth: OAuth 2.0 Refresh Token grant (OIDC-style) to mint short-lived access tokens; per-shop or global credentials supported.
- Rate limiting: in-process queue targeting ~4 requests/sec with retry/backoff for 429/5xx.
- Pagination: vendor-style `token`/`nextToken` pagination is handled by a reusable async paginator.
- Diagnostics: first-class debug endpoints to confirm connectivity, credentials, and endpoints.

Sequence (happy path):
1. Resolve credentials (per-shop JSON from DB or global env) and API base URL.
2. Mint `access_token` using refresh token.
3. Call vendor endpoints via `jumiaFetch()` with rate-limiter and retries.
4. Use `jumiaPaginator()` to iterate pages.
5. Aggregate, normalize, or compute KPIs; optionally cache (memory/Redis/DB).

---

## 2) Key modules and responsibilities

- `src/lib/jumia.ts`
  - `jumiaFetch(path, init?)`: central wrapper that adds Authorization header, applies rate-limiter, retries, and parses responses.
  - `jumiaPaginator(pathBase, initialParams, fetcher)`: async generator for token/nextToken pagination.
  - Helper endpoints: `getCatalogProducts`, `getCatalogProductsCountQuick*`, `getCatalogProductsCountExact*`, `getShops`, `getShopsOfMasterShop`.
  - Base/credential resolution: `resolveApiBase`, `loadShopAuthById`, `loadDefaultShopAuth`.
  - RPS limiter and metrics: `getJumiaQueueMetrics()`.
- `src/lib/oidc.ts`
  - OIDC refresh flow used by `getJumiaAccessToken()` (not returning secrets; caches token TTL).
- `src/lib/kpisCache.ts`
  - Cross-shop KPIs caching (memory + Redis + Postgres `Config`).
- Prisma models (see `prisma/schema.prisma`):
  - `Shop` holds `credentialsEncrypted` (per-shop JSON, optionally encrypted with `SECURE_JSON_KEY`).
  - `ApiCredential` holds global or per-shop API credentials (issuer/clientId/refreshToken, apiBase).

---

## 3) Configuration and credentials

Supported environment variables (either standard or legacy):
- `base_url` (preferred), or `JUMIA_API_BASE`: vendor API base (e.g., `https://vendor-api.jumia.com`).
- `OIDC_ISSUER` or `JUMIA_OIDC_ISSUER`: issuer base; if present, the library derives the token endpoint.
- `OIDC_CLIENT_ID` or `JUMIA_CLIENT_ID`
- `OIDC_CLIENT_SECRET` or `JUMIA_CLIENT_SECRET` (optional; not always needed for refresh flow)
- `OIDC_REFRESH_TOKEN` or `JUMIA_REFRESH_TOKEN`
- `SECURE_JSON_KEY`: if set, shop credentials JSON is stored encrypted in DB.

Per-shop credentials storage (either works):
- `Shop.credentialsEncrypted`: JSON like `{ apiBase, base_url, tokenUrl, clientId, refreshToken, platform }` (encrypted when `SECURE_JSON_KEY` is set).
- `ApiCredential` rows: `scope="SHOP:<shopId>"`, `apiBase`, `clientId`, `refreshToken` (optional `issuer`).

Seeding helpers:
- Script: `scripts/seed-shops.ts` (reads `shops.json` and writes shops with credentials).
- API: `POST /api/debug/seed-shop?token=SETUP_TOKEN` body `{ name, platform, credentials }`.

---

## 4) Calling the vendor API

Contract: `jumiaFetch(path, init?)`
- Input: `path` like `/catalog/products?size=100&sids=<sid1,...>`; optional `{ shopAuth }` in `init` to force per-shop credentials.
- Output: parsed JSON or text; throws with rich error on non-2xx (`status`, `body`).
- Behavior: obtains access token using `getJumiaAccessToken()`; sets `Authorization: Bearer <token>`; schedules via rate limiter; retries on 429/5xx with backoff.

Pagination: `jumiaPaginator('/catalog/products', { size: '200', sids: '...' })`
- Yields each page; determines `nextToken` from common fields (`nextToken | token | next`). Stops when no next token or time cap is hit.

Typical endpoints used:
- `/catalog/products` with query `size`, `token`, optional `sids` or `shopId`
- `/catalog/stock` to pull global stock per product
- `/shops`, `/shops-of-master-shop` to discover shop SIDs

---

## 5) Counting products (totals) and status breakdowns

Two strategies:

1) Fast path via metadata total
- Ask for `size=1` and read numeric total from common metadata keys (e.g., `total`, `totalCount`, `totalElements`, etc.).
- Implementations: `getCatalogProductsCountExactForShop()` and `getCatalogProductsCountExactAll()` try this first.

2) Scan pages within a safety cap
- Iterate via `jumiaPaginator()`; count items and optionally group by item status (`active`, `disabled`, etc.).
- Time-bounded and page-capped to avoid long/expensive runs; sets `approx: true` if cut short.
- Implementations: `getCatalogProductsCountQuick`, `getCatalogProductsCountQuickForShop`.

Debug API to confirm totals quickly (no heavy scan):
- `GET /api/debug/jumia/products-count?shopName=... | shopId=... | sids=...`
  - Returns `{ ok, total, approx, source: 'metadata'|'scan' }`.

---

## 6) Shop scoping options

To scope by shop:
- Per-shop credentials (`Shop.credentialsEncrypted` or `ApiCredential`) → loader returns `shopAuth`, passed into `jumiaFetch` as `{ shopAuth }`.
- Query params supported by vendor:
  - `sids=<sid1[,sid2]>` to scope across multiple seller IDs.
  - `shopId=<prismaShopId>` is supported by our wrapper and forwards a per-shop auth when possible.

Discovery helpers:
- `GET /api/shops` (DB shops)
- `GET /api/debug/shops-auth` (non-secret summary of where creds exist per shop)
- `POST /api/shops/{id}/auth-source` (attempts a token mint using per-shop JSON; returns source name only)
- `GET /api/debug/jumia?probe=true` (deep checks for vendor paths and auth scheme)

---

## 7) Rate limits, retries, and timeouts

- Default rate: ~4 req/sec; enforced by an in-process queue.
- Retries: automatic on HTTP 429 and 5xx with exponential backoff and small jitter; honors `Retry-After` when present.
- Time caps: most scans bound by `timeMs` and/or `maxPages`.
- Metrics: `getJumiaQueueMetrics()` → `{ inFlight, pending, totalRequests, totalRetries, avgLatencyMs }`.

---

## 8) Caching, KPIs, and background jobs

- Quick, in-memory TTL for product counts (used for UI snappiness when exact totals cannot be read).
- Cross-shop KPIs persisted in DB `Config` and optionally Redis (`src/lib/kpisCache.ts`).
- Background job (`src/lib/jobs/kpis.ts`): updates cached KPIs; prefers exact count (metadata) and falls back safely.
- API to recompute immediately: `POST /api/metrics/kpis/refresh`.

---

## 9) Diagnostics and health

- `GET /api/health`: DB/auth quick check and basic product counter.
- `GET /api/debug/oidc?test=true`: attempts token mint and reports whether OIDC creds are configured (no secrets).
- `GET /api/debug/jumia`: sanity checks for common endpoints; `?probe=true` performs deep enumerations across base candidates.
- `GET /api/debug/jumia/products-count`: confirm totals by name, shopId, or sid list.
- `GET /api/debug/shops-auth`: per-shop credential presence (non-secret summary).

---

## 10) Contract examples

A) `GET /api/debug/jumia/products-count?shopName=JM%20Latest%20Collections`
- Response:
```json
{
  "ok": true,
  "by": "shopName",
  "shop": { "name": "JM Latest Collections", "sid": "..." },
  "total": 9446,
  "approx": false,
  "source": "metadata"
}
```

B) `getCatalogProducts({ size?: number, token?: string, sids?: string[], sellerSku?: string, categoryCode?: number, shopId?: string })`
- Returns raw vendor JSON for the page; use `jumiaPaginator()` to iterate all pages.

C) `jumiaPaginator('/catalog/products', { size: '200', sids: '<sid1,sid2>' })`
- Yields each page; read `page.products | page.items | page.data` arrays.

---

## 11) Local testing & examples

PowerShell (optional):
```powershell
# Mint an access token using refresh token
$body = @{ grant_type="refresh_token"; client_id=$env:OIDC_CLIENT_ID; refresh_token=$env:OIDC_REFRESH_TOKEN }
$token = (Invoke-RestMethod -Method Post -Uri "$env:OIDC_TOKEN_URL" -ContentType "application/x-www-form-urlencoded" -Body $body).access_token
$h = @{ Authorization = "Bearer $token" }

# Read first 5 products for a seller SID
$sid = "<SID>"
Invoke-RestMethod -Method Get -Uri "https://vendor-api.jumia.com/catalog/products?size=5&sids=$sid" -Headers $h | ConvertTo-Json -Depth 6
```

cURL (optional):
```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  'https://vendor-api.jumia.com/catalog/products?size=1&sids=<SID>' | jq .
```

---

## 12) Security and hardening

- Never log tokens or secrets; debug routes only report booleans and metadata.
- Store per-shop JSON encrypted when `SECURE_JSON_KEY` is set.
- Use per-shop credentials when possible to limit blast radius.
- Limit rate and retries to vendor guidance; back off on 429.

---

## 13) Onboarding checklist (external integrator)

1. Provision vendor refresh-token credentials (clientId, refreshToken, issuer/base_url).
2. Choose scoping: per-shop JSON (preferred) or global env.
3. Configure environment variables (see §3) and/or seed shop credentials.
4. Verify token mint: `GET /api/debug/oidc?test=true` (expect `test.ok=true`).
5. Confirm vendor connectivity: `GET /api/debug/jumia` (and `?probe=true` if needed).
6. Validate catalogue read: `GET /api/debug/jumia/products-count?sids=<SID>` should return a numeric total.
7. Wire UI or jobs as needed; monitor via `getJumiaQueueMetrics()` and health endpoints.

---

## 14) Troubleshooting

- 401 Unauthorized / "Authorization type is invalid":
  - Check token mint succeeded; ensure `Authorization: Bearer <token>`; verify `base_url` matches tenant.
- 404 "no Route matched":
  - Some tenants expose only `/` (no `/api` or `/v1` prefixes). Use probes to determine the correct base.
- `approx: true` on totals:
  - Metadata total not present or scan timed out; increase time caps temporarily, or rely on background exact count once credentials are in place.
- Slow pagination:
  - Reduce `size`, respect vendor RPS; inspect `avgLatencyMs` via queue metrics.

---

## 15) File index (jump points)

- Wrappers & helpers: `src/lib/jumia.ts`
- OIDC helpers: `src/lib/oidc.ts`
- KPI cache: `src/lib/kpisCache.ts`
- Debug routes: 
  - `src/app/api/debug/jumia/route.ts`
  - `src/app/api/debug/oidc/route.ts`
  - `src/app/api/debug/jumia/products-count/route.ts`
  - `src/app/api/debug/shops-auth/route.ts`
- Proxy (limited allowlist): `src/app/api/jumia/proxy/route.ts`
- Shop management: `src/app/api/shops/route.ts`, `src/app/api/shops/[id]/auth-source/route.ts`
- Seeding: `scripts/seed-shops.ts`, `scripts/create-shop.ts`, `src/app/api/debug/seed-shop/route.ts`

---

This document describes the current production-oriented integration paths. If your tenant exposes additional endpoints (e.g., feeds, consignment), the same `jumiaFetch`/`jumiaPaginator` patterns apply.
