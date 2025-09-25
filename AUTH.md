# Authentication & Deployment

This project uses NextAuth for Google SSO and persists user roles in the database via Prisma.

## What changed

- A `User` model was added to `prisma/schema.prisma` to persist user roles (`ADMIN` / `ATTENDANT`).
- NextAuth callbacks now upsert a `User` record on sign-in and attach the role to the session.
- The app enforces a single admin account via the `ADMIN_EMAIL` environment variable (set it to `kiokojackson81@gmail.com` if you want that account to always be ADMIN).

## Required environment variables

Set these in Vercel (and locally in `.env.local` for development):

- `GOOGLE_CLIENT_ID` — OAuth client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — OAuth client secret
- `NEXTAUTH_SECRET` — a long random string used by NextAuth
- `ADMIN_EMAIL` — the admin email to force to ADMIN (e.g. `kiokojackson81@gmail.com`)
- `DATABASE_URL` — connection string for your database (SQLite, Postgres, etc.)

## Prisma migration steps (must run after pulling schema changes)

After pulling the branch that contains the updated `prisma/schema.prisma`, run the following where your database is available.

PowerShell (Windows):

```powershell
# Install prisma CLI if not present (optional)
npm install prisma --save-dev

# Create and apply a new migration locally
npx prisma migrate dev --name add-user-model

# Regenerate Prisma client
npx prisma generate
```

Notes:
- If you're using SQLite (development), the migration will create/update the local file.
- For production (Postgres, MySQL), run migrations against the production DB before deploying the app that depends on the new schema.

## Vercel deployment steps

1. Add the required environment variables to your Vercel project (Production and Preview as appropriate).
2. If your deployment needs DB migrations, run them against the production database prior to the first production deploy. You can run migrations manually or add a pre-deploy job.
3. Redeploy the project (push to the branch or trigger a redeploy in the Vercel dashboard).

## Quick verification

- After deployment, visit `/api/health` — it will return a JSON object with `authReady` (true if auth is initialized) and `productCount`.
- Sign in with Google using the account specified in `ADMIN_EMAIL` — it should be assigned the `ADMIN` role and redirected to `/admin`.

## Troubleshooting

- If roles don't persist: ensure you ran `npx prisma migrate dev` and `npx prisma generate` and that `DATABASE_URL` points to the correct DB.
- If Next.js/Vercel build fails due to NextAuth route exports, make sure the NextAuth configuration is imported from a shared module (this repo already moves `authOptions` into `src/lib/nextAuth.ts`).

If you'd like, I can add a GitHub Actions workflow or a Vercel pre-deploy step to run migrations automatically. Let me know which option you prefer.
