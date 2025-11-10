This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Docs

- Environment setup: `docs/ENVIRONMENT.md`
- Redesign plan: `docs/REDESIGN_PLAN.md`
- Architecture decisions: `docs/adr/`
 - Vercel deploy notes and crons: `VERCEL_DEPLOY.md`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Operations

- Incremental Jumia orders sync runs via an API job and Vercel Cron (see `vercel.json`).
- Optional retention control for stored vendor orders:
	- Set `JUMIA_ORDERS_RETENTION_DAYS` in your environment to control how many days of `JumiaOrder` we keep (default: 60).
	- Nightly cleanup:
		- GitHub Actions workflow `.github/workflows/nightly-cleanup.yml` runs daily at 02:00 UTC.
		- Set repo secrets: `DATABASE_URL` (required), `DIRECT_URL` (optional), and optionally `JUMIA_ORDERS_RETENTION_DAYS`.
		- You can also run locally: `npm run cleanup:jumia-orders`.

### Bulk Jumia actions (per shop)

From Admin → Orders, select a Jumia shop in the Filters. A Bulk Actions bar appears:

- Pack all: Packs all PENDING items using the shop's default shipping station.
- RTS all: Marks PACKED items Ready-To-Ship.
- Print all: Prints labels for READY_TO_SHIP/SHIPPED/DELIVERED items.

Default shipping station (per shop):

- Enter the providerId (e.g., Lucytec or Ckantarial provider ID) in the "Default station" input and click Save. This is used by "Pack all".

API endpoints (for automation):

- POST `/api/jumia/orders/bulk/pack` { shopId, orderIds?, limit? }
- POST `/api/jumia/orders/bulk/ready-to-ship` { shopId, orderIds?, orderItemIds?, limit? }
- POST `/api/jumia/orders/bulk/print-labels` { shopId, orderIds?, orderItemIds?, includeLabels?, limit? }
- GET/POST/DELETE `/api/settings/jumia/shipping-defaults` to manage per-shop default shipment providers.

Notes:

- Bulk endpoints compute eligible items by calling the vendor API for order items, batching calls with rate limits.
- If a provider requires a tracking code, one is auto-generated when missing.
- After each bulk action, an incremental sync is triggered for fast UI updates.

### Prisma migrations & enum patch

- Migrations are applied in CI (see `.github/workflows/prisma-and-vercel.yml`).
- Manual run:
	- `npm run prisma:generate`
	- `npm run prisma:migrate` (deploy existing migrations)
- Post-deploy enum reconciliation (Shop.platform → `public."Platform"`):
	1. Ensure file `prisma/post_deploy_patch_fix_public_platform_enum.sql` exists in the build.
	2. Send `POST /api/debug/post-deploy-patch` with header `X-Patch-Secret: $PATCH_SECRET`.
	3. Response lists applied statements; idempotent (safe to re-run).
	4. Verify: `select data_type from information_schema.columns where table_name='Shop' and column_name='platform';` should show `USER-DEFINED` and enum present via `\dT+ public.Platform`.

### DB-only orders mode

When `ORDERS_FORCE_DB=1` is set:

- All order statuses are treated as "synced" (no vendor API live fetch divergence logic).
- Pending page server-render will use only DB snapshot rows; initial blank snapshot triggers a one-time server prefetch to avoid empty UI.
- KPI endpoint skips live vendor adjustments and relies solely on persisted counters.
- Use this mode for stability during vendor API outages or to validate server data integrity.

Environment flags influencing orders & KPIs:

- `ORDERS_FORCE_DB`: Force all statuses to be considered synced.
- `JUMIA_ORDERS_RETENTION_DAYS`: Limit stored historical vendor order rows.

### Shop maintenance scripts

Seeding & export utilities for Jumia (and Kilimall) shops:

| Script | Purpose |
|--------|---------|
| `npm run seed:shops [path]` | Upsert shops from a seed file (auto-picks one of `shops.secrets.json`, `shops.local.json`, ...). Encrypts credentials if `SECURE_JSON_KEY` set. |
| `npm run sync:jumia-shops -- --prune shops.secrets.json` | Synchronize legacy `JumiaShop` records to `Shop` entries; optionally prune extras. |
| `npm run list:shops` | List all shops (id, platform, active). |
| `npm run shops:export -- --format=csv` | Export shops in CSV/JSON for auditing. |
| `npm run dedupe:shops` | Generic case-insensitive deduplication (safe: only deletes duplicates without references). |
| `npm run fix:duplicate-betech-store` | Targeted merge/removal for a known duplicate case of `Betech Store` vs `Betech store`. |

Seed file format (example `shops.secrets.json`):

```jsonc
{
	"shops": [
		{
			"name": "JM Collection",
			"platform": "JUMIA",
			"active": true,
			"credentials": {
				"apiBase": "https://vendor-api.jumia.com",
				"tokenUrl": "https://vendor-api.jumia.com/token",
				"clientId": "<clientId>",
				"refreshToken": "<refreshToken>",
				"authType": "SELF_AUTHORIZATION"
			}
		}
	]
}
```

Kilimall credentials variant requires `appId` and `appSecret`; `apiBase` auto-defaults if missing.

### Post-deploy patch endpoint security

- `PATCH_SECRET` must be set in env; request must supply `X-Patch-Secret` header.
- Endpoint lists files via `GET /api/debug/post-deploy-patch` for visibility prior to `POST`.
- Only executes `post_deploy_patch_*.sql` and the enum fix file.

### Cleanup legacy enum patch files

Old patch files (`post_deploy_patch_create_platform_enum.sql`, `post_deploy_patch_cast_platform.sql`, etc.) were superseded by `post_deploy_patch_fix_public_platform_enum.sql`. Remove or archive them to avoid accidental reapplication and schema drift.

