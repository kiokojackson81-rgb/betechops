-- Migration: add unique constraint on (statementNumber, weekStart)
-- Strategy: archive duplicate rows into "MarketplacePayoutWeek_archive" then create unique index.

BEGIN;

-- 1) Ensure archive table exists (schema preserved)
CREATE TABLE IF NOT EXISTS "MarketplacePayoutWeek_archive" (LIKE "MarketplacePayoutWeek" INCLUDING ALL);

-- 2) Find duplicate groups and move duplicates (keeping one canonical row per group)
DO $$
DECLARE
  rec RECORD;
  ids TEXT[];
  keep_id TEXT;
BEGIN
  FOR rec IN
    SELECT m."statementNumber" AS statementNumber, m."weekStart" AS weekStart,
      array_agg(m.id ORDER BY (CASE WHEN ((m."rawPayload"->>'shopSid') IS NOT NULL AND (m."rawPayload"->>'shopSid') = (SELECT "jumiaShopSid" FROM "MarketplaceAccount" WHERE id = m."accountId") ) THEN 0 ELSE 1 END), m."updatedAt" DESC) AS ids
    FROM "MarketplacePayoutWeek" m
    GROUP BY m."statementNumber", m."weekStart"
    HAVING count(*) > 1
  LOOP
    ids := rec.ids;
    IF array_length(ids,1) <= 1 THEN
      CONTINUE;
    END IF;
    keep_id := ids[1];
    -- move the rest to archive
    ids := ids[2:array_length(ids,1)];
    IF array_length(ids,1) > 0 THEN
      INSERT INTO "MarketplacePayoutWeek_archive"
      SELECT * FROM "MarketplacePayoutWeek" WHERE id = ANY(ids);

      DELETE FROM "MarketplacePayoutWeek" WHERE id = ANY(ids);
    END IF;
  END LOOP;
END$$;

-- 3) Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplacePayoutWeek_statement_weekStart_uidx" ON "MarketplacePayoutWeek" ("statementNumber", "weekStart");

COMMIT;
