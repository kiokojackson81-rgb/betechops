# Changelog

## Unreleased - 2025-11-15

- jumia: retry with global/env token on 422 when a SHOP-scoped token is used; include retry outcome in logs for diagnostics.
- jumia: strip `shopId` query parameter when using shop-scoped tokens to avoid vendor 400/422 errors; add warning log.
- jumia: enrich error logs with `apiBase`, `shopKey`, and `X-Shop-Code` header to make production debugging easier.

Notes:
- Change is safe: adds observability and a single retry attempt; no behavioral change for successful requests.
- Recommended next step: deploy to Vercel and monitor logs for enriched entries to map failing orderId/shop pairs.
