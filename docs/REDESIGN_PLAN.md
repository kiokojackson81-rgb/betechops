# Redesign Plan

## Goals
- Reliable production: zero-crash admin, clear diagnostics, safe DB migrations
- Clear separation: core domain, integrations (Jumia), UI, platform concerns (auth, observability)
- Faster developer loop and simpler deployments

## Constraints & Assumptions
- Keep Next.js (App Router), Prisma, Postgres, NextAuth
- Support Vercel serverless (Neon pooled Postgres)
- Preserve current env/secret model; expand where useful

## Target Architecture
- Packages/modules by concern:
  - `core` (domain models, services)
  - `data` (Prisma client, repositories, migrations)
  - `auth` (NextAuth config, role mapping, scoping helpers)
  - `integrations/jumia` (OIDC/token, fetch wrappers, mappers)
  - `web` (Next.js app: routes, server components, UI)
  - `ops` (health, diagnostics, background jobs)

- Boundaries
  - Web imports only from `core`, `auth`, `data` (repositories), and `integrations`
  - No direct Prisma calls in UI components (use repository/services)
  - Integrations return typed DTOs; normalize vendor shapes at the edge

## Data & Migrations
- Finalize Postgres schema (Prisma) with idempotent migrations
- Seed strategy per environment
- Add a smoke-test script that validates DB connectivity and minimal queries

## Auth & Access
- One middleware (done), session->role propagation (done)
- Shop scoping centralized (done) and applied consistently to lists + mutations

## Integrations (Jumia)
- Robust OIDC token acquisition (refresh first, cc fallback)
- Pluggable token endpoint: env `JUMIA_OIDC_TOKEN_URL` + issuer variants (added)
- Configurable API base + endpoints; diagnostics + probes (added)

## Observability
- Health API and Admin health dashboard (added)
- Safe degraded UI states (added)
- Optional: structured server logs for external calls

## CI/CD
- Single primary workflow: migrate then deploy (added)
- Manual seed workflow (added)
- Add preview/staging pipeline (optional)

## Migration Strategy (Phased)
1) Stabilize runtime (build, health, degraded UI) [done]
2) DB reliability (DATABASE_URL + SSL, migrate on CI) [in-progress]
3) Jumia OIDC correctness (explicit token URL if needed, verified probes)
4) Repository/services refactor to remove direct Prisma from pages (incremental)
5) UX improvements (dashboards, tables, forms), test coverage

## Risks
- Vendor auth endpoint differences (/auth/realms vs /realms) — mitigated by candidates + override
- Serverless limits (timeouts) — keep calls lean, add retries where safe
- Migration drift — use CI migration stage and lock

## Acceptance Criteria
- /admin renders with no crashes
- /admin/health-checks shows dbOk=true and OIDC test ok:true in prod
- Jumia probes return data or precise actionable errors
- All admin lists operate with shop scoping
