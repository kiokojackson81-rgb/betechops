Migration notes: add `pricedAt` timestamp
-----------------------------------------

This project added an optional `pricedAt` DateTime field to `MarketingSale`
and `SupportReceiptItem` to make profit attribution deterministic and to
allow pricing events to be attributed to the date they occurred.

Deployment steps (recommended):

1. Create a Prisma migration locally (or in CI) from the repo root:

```pwsh
npx prisma migrate dev --name add_pricedAt_fields --create-only
```

2. Review the generated SQL in `prisma/migrations/*/migration.sql`.

3. Apply the migration in your environment with:

```pwsh
npx prisma migrate deploy --schema prisma/schema.prisma
```

4. If you need to mark an existing migration as applied (manual adoption), use:

```pwsh
npx prisma migrate resolve --schema prisma/schema.prisma --applied <migration_name>
```

5. The new `pricedAt` fields are nullable. Existing records will have
   `pricedAt = NULL`. The server code falls back to `createdAt` / `updatedAt`
   for attribution where `pricedAt` is not present.

6. After migrating, redeploy the application. Pricing routes will populate
   `pricedAt` for newly-priced records going forward.

Notes:
- If you prefer immediate backfill of historical `pricedAt` values, plan a
  controlled backfill script that sets `pricedAt` from `createdAt`/`updatedAt`
  according to your policy. This is optional and should be done carefully.
