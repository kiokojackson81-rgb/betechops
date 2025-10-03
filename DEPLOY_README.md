Quick deploy notes

1) Push your branch to GitHub (branch-3).
2) Add the following repository secrets in GitHub (Settings → Secrets → Actions):
   - DATABASE_URL (Postgres connection string)
   - VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID (for CLI deploy step)
   - NEXTAUTH_SECRET
   - GOOGLE_CLIENT_ID (if using Google login)
   - GOOGLE_CLIENT_SECRET (if using Google login)
3) The workflow `.github/workflows/prisma-and-vercel.yml` runs on push and will:
   - Install deps and generate Prisma client
   - Run `prisma migrate deploy` against DATABASE_URL
   - Deploy to Vercel using the CLI with the provided Vercel vars
4) Configure the same env vars in Vercel Project Settings → Environment Variables. You can also set Jumia credentials here or manage via `/api/settings/jumia`.

Extras
- Example env file: see `.env.example` in the repo
- OIDC diagnostics: `/api/debug/oidc?test=true`