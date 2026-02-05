-- Patch to align MarketplacePayoutWeek rows and WeeklySale rows
-- Week: 2025-12-29 → 2026-01-04 (canonical Nairobi week stored as UTC weekStart 2025-12-28T21:00:00Z)
-- IMPORTANT: Backup DB before running. Run inside a transaction.

BEGIN;

-- 1) Update MarketplacePayoutWeek rows to Vendor Center amounts
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 424086.62, grossSales = 424086.62, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE12DBU';
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 239368.33, grossSales = 239368.33, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE13ZAF';
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 196243.91, grossSales = 196243.91, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE12Y26';
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 176488.18, grossSales = 176488.18, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE12DWN';
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 171407.13, grossSales = 171407.13, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE133G3';
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 82472.25, grossSales = 82472.25, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE13LSZ';
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 8527.82, grossSales = 8527.82, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE13XZB';
UPDATE "MarketplacePayoutWeek" SET payoutAmount = 0.00, grossSales = 0.00, currency = 'LOCAL' WHERE statementNumber = 'PS251229KE14JOD';

-- 2) Upsert WeeklySale rows for these shops (use canonical stored weekStart/weekEnd used by app)
-- Canonical stored values (UTC): weekStart = '2025-12-28T21:00:00Z', weekEnd = '2026-01-04T20:59:59.999Z'

-- Betech Store
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 424086.62, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = 'c897dcd1-5a4d-4d68-80ff-e8fda74f79e4'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

-- Sky Store Ke
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 239368.33, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = 'a4f06613-3271-4846-8b25-43b2bc093a80'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

-- Hitech Power
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 196243.91, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = '1951e826-57f2-4d6a-99ad-67b5139d8aca'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

-- JM Latest Collections
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 176488.18, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = 'db15d4e6-19a0-4cc1-b8c9-0619c5388643'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

-- Jude Collection
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 171407.13, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = '5497640c-3f51-4777-82fa-fc1c92dc588b'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

-- Betech Solar Solution
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 82472.25, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = '29e1f2ad-b898-4d11-b3df-ab3dda57755fc'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

-- Maxton Enterprise
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 8527.82, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = '07ee95b2-acb7-4436-b98f-d8ce30d0c518'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

-- LabTech Kenya (0 amount)
INSERT INTO "WeeklySale" ("shopId","userId","weekStart","weekEnd","amount","createdAt","platform","source","createdBy","status")
SELECT s.id, NULL, '2025-12-28T21:00:00.000Z'::timestamptz, '2026-01-04T20:59:59.999Z'::timestamptz, 0.00, now(), 'JUMIA', 'AUTOMATIC', NULL, 'PENDING'
FROM "Shop" s WHERE s.jumiaShopSid = '45fd7334-a7db-4f49-ba60-347096fd818e'
ON CONFLICT ("shopId","platform","weekStart","weekEnd") DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status, source = EXCLUDED.source;

COMMIT;

-- End of patch
