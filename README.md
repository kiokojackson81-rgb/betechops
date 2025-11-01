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

Prisma migrations

- Migrations are applied in CI (see `.github/workflows/prisma-and-vercel.yml`).
- You can also run them manually:
	- `npm run prisma:generate`
	- `npm run prisma:migrate` (alias for `prisma migrate deploy`)
