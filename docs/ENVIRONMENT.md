# Environment Configuration

Set these in Vercel project settings (Environment Variables) and locally (e.g., .env, not committed):

## Core
- NEXTAUTH_URL: https://<your-domain>
- NEXTAUTH_SECRET: <random strong secret>
- GOOGLE_CLIENT_ID: <oauth client id>
- GOOGLE_CLIENT_SECRET: <oauth client secret>
- DATABASE_URL: postgresql://<user>:<pass>@<host>/<db>?sslmode=require

## Jumia OIDC + API
- JUMIA_API_BASE: https://vendor-api.jumia.com (example)
- JUMIA_OIDC_ISSUER: https://vendor-api.jumia.com/realms/acl (or /auth/realms/acl)
- JUMIA_CLIENT_ID: <client id>
- JUMIA_CLIENT_SECRET: <client secret> (optional when using refresh_token but required for client_credentials)
- JUMIA_REFRESH_TOKEN: <long-lived refresh token>
- JUMIA_OIDC_TOKEN_URL: https://.../protocol/openid-connect/token (optional explicit override)

Optional endpoint overrides if your vendor uses different paths:
- JUMIA_EP_SALES_TODAY: /reports/sales?range=today
- JUMIA_EP_PENDING_PRICING: /orders?status=pending-pricing
- JUMIA_EP_RETURNS_WAITING_PICKUP: /returns?status=waiting-pickup

## Notes
- Prefer Neon or another hosted Postgres with pooled connections. Keep `sslmode=require` in `DATABASE_URL` for Vercel.
- If OIDC test fails with 404, set `JUMIA_OIDC_TOKEN_URL` explicitly to the token endpoint.
- After editing envs, redeploy to apply.
