Quick deploy notes

1) Push your branch to GitHub (branch-3).
2) Add the following repository secrets in GitHub (Settings → Secrets → Actions):
   - DATABASE_URL
   - NEXTAUTH_SECRET
   - GOOGLE_CLIENT_ID (if used)
   - GOOGLE_CLIENT_SECRET (if used)
3) The `prisma-migrate.yml` workflow will run migrations on push and generate the Prisma client.
4) Connect the repository to Vercel and configure the same env vars in Vercel.

If you prefer me to open a PR with these changes and a ready-to-deploy branch, I can do that next.