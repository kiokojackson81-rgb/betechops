Deployment checklist for Vercel

This project uses Next.js (App Router), NextAuth, and Prisma.

Before you deploy on Vercel

1) Environment variables (set in Vercel Project > Settings > Environment Variables):
   - DATABASE_URL  — A connection string to your production database. For Vercel you should use a hosted Postgres (recommended) or Planetscale. Example: `postgresql://USER:PASSWORD@HOST:5432/dbname?schema=public`
   - NEXTAUTH_SECRET — A long random string for NextAuth session encryption.
   - NEXTAUTH_URL — Your site URL e.g. `https://your-app.vercel.app`
   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — If you use Google SSO (NextAuth) for auth.
   - Any other API keys used by your app (e.g. JUMIA credentials) as `SHOP_API_KEY` etc.

Important note about SQLite

- This repo is configured for Postgres in production. Ensure `DATABASE_URL` uses a `postgresql://` scheme.
- Local SQLite is no longer used by default; any `dev.db` is ignored. Use a local Postgres if you want dev parity.

Database migrations and seeding

- CI uses `npx prisma migrate deploy` (see `.github/workflows/prisma-and-vercel.yml`).
- If you need to seed data, run `node prisma/seed.js` once against the production DB (be careful not to overwrite production data).

Recommended workflow

1. Provision a hosted Postgres DB and set the `DATABASE_URL` secret in Vercel.
2. In your CI (or a one-off job), run:
   - `npx prisma generate`
   - `npx prisma migrate deploy`
   - optionally `node prisma/seed.js` (if you need initial data)
3. Deploy the Next.js app to Vercel. The `postinstall` script runs `prisma generate` on install.

Jumia configuration

- You can configure Jumia OIDC/API either via env vars or via the API:
   - GET/POST `/api/settings/jumia` stores credentials in `ApiCredential(scope="GLOBAL")`.
   - Diagnostics: `/api/debug/oidc?test=true` to verify refresh-token exchange.

Per-shop credentials via environment variables

- When each shop has its own credentials, you can define shop-specific env vars instead of (or in addition to) DB-stored JSON. The loader first checks per-shop env, then the DB, then global env.
- Supported patterns (SHOPID is the shop UUID; it will be uppercased and non-alphanumerics replaced with `_`):

   - `SHOP_<SHOPID>_JUMIA_CLIENT_ID`
   - `SHOP_<SHOPID>_JUMIA_REFRESH_TOKEN`
   - Optional base URL: `SHOP_<SHOPID>_BASE_URL` or `SHOP_<SHOPID>_JUMIA_API_BASE`

   Alternative suffix style:

   - `JUMIA_CLIENT_ID__<SHOPID>`
   - `JUMIA_REFRESH_TOKEN__<SHOPID>`
   - Optional base URL: `JUMIA_API_BASE__<SHOPID>` or `BASE_URL__<SHOPID>`

- Example:

   - SHOP ID: `a1b2c3d4-e5f6-4aaa-9bbb-ccccdddd0000` → SID: `A1B2C3D4_E5F6_4AAA_9BBB_CCCCDDDD0000`
   - Set:
      - `SHOP_A1B2C3D4_E5F6_4AAA_9BBB_CCCCDDDD0000_JUMIA_CLIENT_ID=...`
      - `SHOP_A1B2C3D4_E5F6_4AAA_9BBB_CCCCDDDD0000_JUMIA_REFRESH_TOKEN=...`
      - (optional) `SHOP_A1B2C3D4_E5F6_4AAA_9BBB_CCCCDDDD0000_BASE_URL=https://vendor-api.jumia.com`

- Validate per-shop credentials without DB:

   - `GET /api/debug/oidc?test=true&shopId=<SHOPID>` → returns `shopMint.ok=true` if mint succeeds using per-shop env or DB.

Troubleshooting

- If you see runtime errors about `prisma` or `prisma client`, ensure `prisma generate` ran successfully and `DATABASE_URL` is set.
- If your NextAuth sessions are missing roles or user data, verify `NEXTAUTH_SECRET` and the Google client secrets are set.

If you want, I can:
- Add a GitHub Actions workflow to run migrations before (or during) Vercel deployments.
- Help provision a managed Postgres and update the `.env` + migration pipeline.
