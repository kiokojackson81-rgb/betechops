# JUMIA Normalization Dry-Run Plan

Purpose: normalize JUMIA marketplace accounts so there is exactly one active `MarketplaceAccount` per true `jumiaShopSid`, attach credentials correctly, prevent duplicate statement attribution, and backfill deduplicated payouts. This is a DRY-RUN plan — do not run destructive SQL until reviewed.

Files generated:
- .tmp/jumia_proposed_mapping.json (canonical mapping for review)
- .tmp/jumia_clientid_shopmapping.json (observed credential -> shopSid mapping)
- .tmp/jumia_accounts_with_creds.json (current DB accounts & cred rows)

High-level steps (dry-run):

1) Verify ownership and conflicts
- Review `.tmp/jumia_proposed_mapping.json` and confirm owner for shopSid `db15d4e6-...` (conflict between client `e20e...` and `f7df...`).
- For `JUDE COLLECTIONS` create ApiCredential with provided clientId/refresh token and re-run mapping script to discover shopSid.

2) Dry-run queries to inspect duplicates and statement attribution

- List marketplace accounts grouped by jumiaShopSid:

  SELECT jumiaShopSid, array_agg(id) AS account_ids, count(*) FROM "MarketplaceAccount" WHERE platform='JUMIA' GROUP BY jumiaShopSid ORDER BY count DESC;

- Show MarketplacePayoutWeek rows that reference the conflicting shopSid(s):

  SELECT id, accountId, statementNumber, payoutAmount, weekStart, weekEnd, rawPayload->>'shopSid' AS shopSid FROM "MarketplacePayoutWeek" WHERE (rawPayload->>'shopSid') = 'db15d4e6-19a0-4cc1-b8c9-0619c5388643' ORDER BY weekStart DESC;

- Detect statements with the same (statementNumber, shopSid, weekStart):

  SELECT (rawPayload->>'statementNumber') AS statementNumber, (rawPayload->>'shopSid') AS shopSid, weekStart, count(*) FROM "MarketplacePayoutWeek" GROUP BY 1,2,3 HAVING count(*) > 1 ORDER BY count DESC LIMIT 100;

3) Proposed non-destructive transforms (dry-run SQL)

- Create an archive table to preserve any rows we will change/delete:

  CREATE TABLE IF NOT EXISTS "MarketplacePayoutWeek_archive" (LIKE "MarketplacePayoutWeek" INCLUDING ALL);

- To mark duplicate MarketplaceAccount rows inactive (example for Betech Solar Solution):

  -- list duplicate account ids first
  SELECT id, displayName, jumiaShopSid FROM "MarketplaceAccount" WHERE displayName ILIKE '%Betech Solar Solution%';

  -- dry-run: show affected payout rows
  SELECT id, accountId, statementNumber FROM "MarketplacePayoutWeek" WHERE accountId IN ('fad5155d-4223-4b58-bec6-87f7a5690c37');

  -- then to deactivate (actual change):
  -- UPDATE "MarketplaceAccount" SET isActive = false WHERE id = 'fad5155d-4223-4b58-bec6-87f7a5690c37';

- To reassign credential linkage (attach credential row to canonical account):

  -- verify credential
  SELECT id, scope, clientId FROM "ApiCredential" WHERE id = '57b10d78-3ef9-4655-bea8-111b13e1d1e9';

  -- dry-run: show no credential currently attached to canonical account
  SELECT id FROM "ApiCredential" WHERE scope = 'MARKETPLACE_ACCOUNT:6e1186af-a6b3-4eb6-9547-1038733c3306';

  -- actual update (if agreed):
  -- UPDATE "ApiCredential" SET scope = 'MARKETPLACE_ACCOUNT:6e1186af-a6b3-4eb6-9547-1038733c3306' WHERE id = '57b10d78-3ef9-4655-bea8-111b13e1d1e9';

4) Statement ingestion guard (code changes, non-destructive)
- Ensure ingestion uses canonical shopSid and statement dedupe key `(statementNumber, shopSid, weekStart)`.
- If fetched `statement.shopSid !== marketplaceAccount.jumiaShopSid`, log `CROSS-SHOP_CREDENTIAL` and write raw statement to an audit table instead of attributing it.

5) Backfill (dry-run path)
- After canonical accounts + credentials are set, run backfill script for JUMIA only:
  - run `scripts/backfill/payouts.js --platform=JUMIA --start=2025-12-29 --end=2026-01-04 --dry-run` to produce proposed WeeklySale upserts.
- Compare existing WeeklySale totals vs proposed deduped totals; require zero differences before committing.

6) Verification queries
- Active Jumia shops list:
  SELECT id, displayName, jumiaShopSid, isActive FROM "MarketplaceAccount" WHERE platform='JUMIA' ORDER BY displayName;

- CROSS-SHOP incidents count:
  SELECT count(*) FROM "MarketplacePayoutWeek" WHERE rawPayload->>'shopSid' IS NOT NULL AND rawPayload->>'shopSid' != (SELECT jumiaShopSid FROM "MarketplaceAccount" WHERE id = "MarketplacePayoutWeek".accountId LIMIT 1);

- Duplicate statement keys per week (should be 0 after normalization):
  SELECT weekStart, (rawPayload->>'statementNumber') AS statementNumber, count(*) FROM "MarketplacePayoutWeek" GROUP BY weekStart, statementNumber HAVING count(*) > 1 ORDER BY weekStart DESC;

7) Safety and rollback
- All destructive actions must be preceded by inserting affected rows into archive tables.
- Take DB backup / snapshot (Neon branch) before running updates.

8) Next steps after review
- If you approve the proposed mapping, I will prepare the exact SQL patch and a Node dry-run script to perform the normalization non-destructively (archive + update + deactivate) and run it with `--dry-run` to show changes, then with `--apply` when you confirm.


