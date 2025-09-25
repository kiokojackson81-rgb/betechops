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

- The local dev `.env` uses SQLite (DATABASE_URL=file:./prisma/dev.db). SQLite is not suitable for Vercel since serverless functions have an ephemeral filesystem.
- For production on Vercel you MUST use a hosted database (Postgres, MySQL, Planetscale, etc.).

Database migrations and seeding

- Use `npx prisma migrate deploy` to run migrations in CI (Vercel build won't run migrations automatically). Your CI or deployment pipeline should run migrations before starting the app.
- If you need to seed data, run `node prisma/seed.js` once against the production DB (be careful not to overwrite production data).

Recommended workflow

1. Provision a hosted Postgres DB and set the `DATABASE_URL` secret in Vercel.
2. In your CI (or a one-off job), run:
   - `npx prisma generate`
   - `npx prisma migrate deploy`
   - optionally `node prisma/seed.js` (if you need initial data)
3. Deploy the Next.js app to Vercel. The `postinstall` script in package.json already runs `prisma generate` on install.

Troubleshooting

- If you see runtime errors about `prisma` or `prisma client`, ensure `prisma generate` ran successfully and `DATABASE_URL` is set.
- If your NextAuth sessions are missing roles or user data, verify `NEXTAUTH_SECRET` and the Google client secrets are set.

If you want, I can:
- Add a GitHub Actions workflow to run migrations before (or during) Vercel deployments.
- Help provision a managed Postgres and update the `.env` + migration pipeline.
