-- Verification queries for pricedAt backfill
SELECT COUNT(*) AS support_pricedAt_null FROM "SupportReceiptItem" WHERE "pricedAt" IS NULL;
SELECT COUNT(*) AS support_pricedAt_not_null FROM "SupportReceiptItem" WHERE "pricedAt" IS NOT NULL;
SELECT COUNT(*) AS marketing_pricedAt_null FROM "MarketingSale" WHERE "pricedAt" IS NULL;
SELECT COUNT(*) AS marketing_pricedAt_not_null FROM "MarketingSale" WHERE "pricedAt" IS NOT NULL;

-- Show recent updated SupportReceiptItem rows
SELECT id, "pricedAt", "updatedAt" FROM "SupportReceiptItem" WHERE "pricedAt" IS NOT NULL ORDER BY "updatedAt" DESC LIMIT 5;

-- Show recent MarketingSale rows with pricedAt
SELECT id, "pricedAt", "createdAt" FROM "MarketingSale" WHERE "pricedAt" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 5;
