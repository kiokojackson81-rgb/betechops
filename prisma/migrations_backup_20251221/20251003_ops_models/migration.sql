-- Ops models for returns, cost, settlements, profit, commissions, and action log
-- NOTE: Prisma will generate SQL; this file provides baseline for deploy environments without prisma migrate.

-- CostCatalog
CREATE TABLE IF NOT EXISTS "CostCatalog" (
  "id" TEXT PRIMARY KEY,
  "sku" TEXT NOT NULL,
  "shopId" TEXT,
  "cost" DECIMAL(12,2) NOT NULL,
  "effectiveFrom" TIMESTAMP NOT NULL,
  "effectiveTo" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "CostCatalog_sku_shopId_effectiveFrom_idx" ON "CostCatalog" ("sku","shopId","effectiveFrom");

-- OrderCost
CREATE TABLE IF NOT EXISTS "OrderCost" (
  "id" TEXT PRIMARY KEY,
  "orderItemId" TEXT NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "costSource" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SettlementRow
CREATE TABLE IF NOT EXISTS "SettlementRow" (
  "id" TEXT PRIMARY KEY,
  "shopId" TEXT NOT NULL,
  "orderId" TEXT,
  "orderItemId" TEXT,
  "kind" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "ref" TEXT,
  "postedAt" TIMESTAMP NOT NULL,
  "raw" JSON NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SettlementRow_shopId_postedAt_idx" ON "SettlementRow" ("shopId","postedAt");
CREATE INDEX IF NOT EXISTS "SettlementRow_orderId_orderItemId_idx" ON "SettlementRow" ("orderId","orderItemId");

-- ProfitSnapshot
CREATE TABLE IF NOT EXISTS "ProfitSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orderItemId" TEXT NOT NULL,
  "revenue" DECIMAL(12,2) NOT NULL,
  "fees" DECIMAL(12,2) NOT NULL,
  "shipping" DECIMAL(12,2) NOT NULL,
  "refunds" DECIMAL(12,2) NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "qty" INTEGER NOT NULL,
  "profit" DECIMAL(12,2) NOT NULL,
  "computedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- CommissionRule
CREATE TABLE IF NOT EXISTS "CommissionRule" (
  "id" TEXT PRIMARY KEY,
  "scope" TEXT NOT NULL,
  "shopId" TEXT,
  "sku" TEXT,
  "category" TEXT,
  "type" TEXT NOT NULL,
  "rateDecimal" DECIMAL(6,4) NOT NULL,
  "effectiveFrom" TIMESTAMP NOT NULL,
  "effectiveTo" TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "CommissionRule_scope_shopId_sku_category_effectiveFrom_idx" ON "CommissionRule" ("scope","shopId","sku","category","effectiveFrom");

-- CommissionEarning
CREATE TABLE IF NOT EXISTS "CommissionEarning" (
  "id" TEXT PRIMARY KEY,
  "staffId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "basis" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL,
  "calcDetail" JSON NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ReturnCase
CREATE TABLE IF NOT EXISTS "ReturnCase" (
  "id" TEXT PRIMARY KEY,
  "shopId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "reasonCode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "resolution" TEXT,
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ReturnCase_shopId_status_idx" ON "ReturnCase" ("shopId","status");

-- ReturnPickup
CREATE TABLE IF NOT EXISTS "ReturnPickup" (
  "id" TEXT PRIMARY KEY,
  "returnCaseId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP NOT NULL,
  "carrier" TEXT NOT NULL,
  "tracking" TEXT,
  "assignedTo" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ReturnEvidence
CREATE TABLE IF NOT EXISTS "ReturnEvidence" (
  "id" TEXT PRIMARY KEY,
  "returnCaseId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "uri" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "takenBy" TEXT NOT NULL,
  "takenAt" TIMESTAMP NOT NULL,
  "geo" JSON,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ReturnAdjustment
CREATE TABLE IF NOT EXISTS "ReturnAdjustment" (
  "id" TEXT PRIMARY KEY,
  "returnCaseId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "commissionImpact" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ActionLog
CREATE TABLE IF NOT EXISTS "ActionLog" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSON,
  "after" JSON,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ActionLog_entity_entityId_idx" ON "ActionLog" ("entity","entityId");
