-- Counts and checks after running online sync
-- active Jumia accounts
SELECT 'active_jumia_accounts' AS probe, COUNT(*) FROM "MarketplaceAccount" WHERE platform = 'JUMIA' AND "isActive" = true;
-- Counts and checks after running online sync
-- active Jumia accounts
SELECT 'active_jumia_accounts' AS probe, COUNT(*) FROM "MarketplaceAccount" WHERE "platform" = 'JUMIA' AND "isActive" = true;

-- placeholders per account (MarketplacePayoutWeek with AUTO: statementNumber)
SELECT "accountId", COUNT(*) AS placeholders_count FROM "MarketplacePayoutWeek" WHERE "statementNumber" LIKE 'AUTO:%' GROUP BY "accountId" ORDER BY placeholders_count DESC LIMIT 100;

-- WeeklySale automatic placeholders per shop
SELECT "shopId", COUNT(*) AS auto_weeklysales FROM "WeeklySale" WHERE "source" = 'AUTOMATIC' GROUP BY "shopId" ORDER BY auto_weeklysales DESC LIMIT 100;

-- manual/overridden weekly sales count
SELECT 'manual_weeklysales' AS probe, COUNT(*) FROM "WeeklySale" WHERE "source" = 'MANUAL' OR "createdBy" IS NOT NULL OR "userId" IS NOT NULL OR "approvedBy" IS NOT NULL;

-- ProfitEvent duplicates (marketplaceOrderId + type)
SELECT "marketplaceOrderId", "type", COUNT(*) AS cnt FROM "ProfitEvent" GROUP BY "marketplaceOrderId", "type" HAVING COUNT(*) > 1 ORDER BY cnt DESC LIMIT 50;
