**BetechOps – Authentication & Category Routing Guidelines**

This document explains how authentication and attendant category routing are implemented in this repository, the enum labels we use, and how to update route permissions or add new categories safely.

**Overview:**
- **Auth:** NextAuth CredentialsProvider (email/password) with bcrypt password verification. JWT sessions store `role` and `attendantCategory`.
- **DB & Prisma:** `User.attendantCategory` is a Postgres enum. The repository is currently aligned to the deployed DB enum labels. Keep Prisma enums and the DB in sync.
- **Routing:** Server `middleware.ts` enforces route-level access based on `attendantCategory`. Client-side redirect helper chooses a landing page after sign-in.

**Current Enum Labels**
- `GENERAL`
- `DIRECT_SALES`
- `JUMIA_OPERATIONS`
- `KILIMALL_OPERATIONS`
- `PRODUCT_UPLOAD`
- `SUPPORT`

Note: Historically the codebase used different/legacy enum names (e.g. `DIRECT_SALES_OPS`, `MARKETING_OPS`). The middleware and helpers accept both styles for compatibility. Prefer the canonical labels above when creating new data.

**Files of Interest**
- `src/lib/nextAuth.ts` — NextAuth configuration. The `CredentialsProvider` validates email/password, fetches `password` and `attendantCategory`, and the callbacks attach `attendantCategory` and `role` to the token and session.
- `prisma/schema.prisma` — Prisma models and enums. Keep this aligned with the production DB.
- `prisma/seed.js` — Upserts admin and attendant users with bcrypt-hashed passwords. Re-run to re-seed (idempotent upserts).
- `middleware.ts` — Server-side route permission enforcement (path prefix → allowed categories).
- `src/lib/auth/helpers.ts` — `getLandingPage(attendantCategory)` picks a post-login landing page.
- `src/components/ClientRedirect.tsx` — Client component that redirects users after sign-in to their landing page.

**How Routing Decisions Are Made**
- After sign-in, NextAuth stores `attendantCategory` in the session JWT via callbacks. The client redirect component reads the session, calls `getLandingPage()`, and redirects the user.
- For protected routes, `middleware.ts` inspects the token and checks whether the user's `attendantCategory` is in the allowed list for that route prefix. If not allowed, middleware redirects to `/not-authorized`.

**Adding a New Category**
1. Decide the canonical enum label (UPPER_SNAKE_CASE). Example: `WAREHOUSE_OPERATIONS`.
2. Add the label to `prisma/schema.prisma` in the `enum AttendantCategory` block.
3. If the target DB has a different set of enum labels already, inspect them first (`scripts/inspect-enums.js` can help) and align.
4. Run Prisma migration or `prisma db push` depending on your environment. Prefer creating a proper migration with `prisma migrate dev` for dev workflows that use a shadow DB; if you cannot use a shadow DB, `prisma db push` will synchronize the schema.
5. Update `prisma/seed.js` to optionally seed a user with that category for testing.
6. Update `src/lib/auth/helpers.ts` to return an appropriate landing page for the new category.
7. Update `middleware.ts` route permissions to include the new category for any protected prefixes.

**Updating Middleware Route Permissions**
- `middleware.ts` contains a `routePermissions` array of objects: `{ prefix: string, categories: string[] }`.
- Categories in `routePermissions` accept both canonical DB labels and legacy labels (middleware currently checks strings directly). When you update categories:
  - Add the canonical label (e.g. `WAREHOUSE_OPERATIONS`) to the appropriate prefix.
  - Optionally add any legacy variants if external systems still use them.

Example: allow `PRODUCT_UPLOAD` and the legacy `MARKETING_OPS` access to `/attendant/daily-report`:

```js
{ prefix: "/attendant/daily-report", categories: ["PRODUCT_UPLOAD", "MARKETING_OPS"] }
```

**Seeding & Passwords**
- Seeds use `bcrypt` to hash passwords. The seed script performs `upsert` operations so it is safe to run repeatedly.
- If you change the enum labels or the user model, adjust the seed mapping to use the canonical enum labels.

**NextAuth Notes & Session Shape**
- The CredentialsProvider must return a user-like object that includes `id`, `email`, `name` and `attendantCategory`. The JWT callback attaches `attendantCategory` to the token and session so middleware can read it server-side.
- Example session object (shape):

```json
{
  "user": { "name": "Jeniffer", "email": "jeniffer@betech.co.ke", "attendantCategory": "PRODUCT_UPLOAD" },
  "expires": "..."
}
```

**Common Troubleshooting**
- Seed fails with "invalid input value for enum": check DB enum labels and align `prisma/schema.prisma` or map names in the seed script.
- `prisma migrate dev` fails with shadow DB errors: either fix the shadow DB or use `prisma db push` for push-based sync (note: migrations are preferred for production).
- Middleware redirects everyone to `/not-authorized`: ensure the category values stored in your JWT/session match the labels used in `routePermissions` (watch for legacy vs canonical label mismatches).

**Recommended Workflow for Changes**
1. Add enum label in `prisma/schema.prisma`.
2. Run `pnpm prisma generate` then `pnpm prisma migrate dev` or `pnpm prisma db push` (depending on env).
3. Update seed (if needed) and run it locally to create test users.
4. Update `src/lib/auth/helpers.ts` and `middleware.ts` to include new category behavior.
5. Test login and protected routes locally.

If you want, I can also add a small verification script that reads the active DB enum labels and prints a recommended `routePermissions` mapping to avoid label mismatches.
