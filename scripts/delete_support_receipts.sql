BEGIN;

-- Capture affected daily entries
CREATE TEMP TABLE tmp_to_update AS
SELECT DISTINCT "dailyEntryId" AS id
FROM "SupportReceipt"
WHERE "receiptNumber" IN ('1030','uy69','1032','8000u','1038','1036','1037','1031','1042','1044','1035','1045');

-- Delete items for those receipts
DELETE FROM "SupportReceiptItem"
WHERE "receiptId" IN (
  SELECT id FROM "SupportReceipt" WHERE "receiptNumber" IN ('1030','uy69','1032','8000u','1038','1036','1037','1031','1042','1044','1035','1045')
);

-- Delete the receipts
DELETE FROM "SupportReceipt"
WHERE "receiptNumber" IN ('1030','uy69','1032','8000u','1038','1036','1037','1031','1042','1044','1035','1045');

-- Recompute totalProfit for affected daily entries from remaining receipts/items
UPDATE "SupportDailyEntry" de
SET "totalProfit" = COALESCE(sub.total_profit, 0)
FROM (
  SELECT r."dailyEntryId" AS id,
         COALESCE(SUM(COALESCE(r."sellingTotal",0)),0) - COALESCE(SUM(COALESCE(it."buyingPrice",0)),0) AS total_profit
  FROM "SupportReceipt" r
  LEFT JOIN "SupportReceiptItem" it ON it."receiptId" = r.id
  WHERE r."dailyEntryId" IN (SELECT id FROM tmp_to_update)
  GROUP BY r."dailyEntryId"
) AS sub
WHERE de.id = sub.id;

-- For entries that now have no receipts, set totalProfit to 0
UPDATE "SupportDailyEntry"
SET "totalProfit" = 0
WHERE id IN (SELECT id FROM tmp_to_update)
  AND NOT EXISTS (SELECT 1 FROM "SupportReceipt" r WHERE r."dailyEntryId" = "SupportDailyEntry".id);

COMMIT;
