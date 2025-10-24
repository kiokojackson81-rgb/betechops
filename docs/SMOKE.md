# Smoke-checks and quick verification

Follow these steps to validate a local dev instance or do a dry-run check after deploying the upgrade.

Prerequisites
- Node and npm installed.
- A Postgres DB available and `DATABASE_URL` set.
- `SECURE_JSON_KEY` set in your environment for encrypt/decrypt helpers.

1) Install deps & generate client

```pwsh
npm ci
npm run prisma:generate
```

2) Apply migrations (local dev/test)

```pwsh
npx prisma migrate deploy
```

3) Start dev server

```pwsh
npm run dev
```

4) Health check

Visit `http://localhost:3000/api/health` or call it:

```pwsh
curl http://localhost:3000/api/health
```

5) Dry-run sync (no secret exposure)

Create a test shop via Admin UI or API with credentials masked. For sync endpoints, support a `?simulate=true` param that prevents external calls and returns a normalized payload preview. Example:

```pwsh
curl -X POST "http://localhost:3000/api/sync/orders?simulate=true"
```

Expected: a JSON response containing an array of `NormalizedOrder` objects (no secrets or full credentials echoed).

6) Returns SLA simulation

Run the returns SLA routine in dry-run mode (do not post ledger changes) to see which `ReturnCase` rows would be marked OVERDUE and what penalty lines would be created.

7) Manual checks
- Create a Kilimall shop (or Jumia) and use `Test connection` in UI. The backend should use `decryptJson` server-side and attempt a non-mutating API call; secrets must not be logged.
- Verify that attendants can only see assigned shops in UI; supervisors can access processing actions.

Notes
- For CI, add a step to run `npm run prisma:generate`, `npm run lint`, and the smoke curl checks above.
