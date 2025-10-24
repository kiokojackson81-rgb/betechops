-- Migration: Multi-marketplace upgrade (add platform, credentialsEncrypted, UserShop, ProductCost,
-- CommissionLedger, Reconciliation, Discrepancy, add dueAt/pickedAt to return_cases)

BEGIN;

-- Add platform and credentialsEncrypted to shop
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "platform" text NOT NULL DEFAULT 'JUMIA';
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "credentialsEncrypted" jsonb;

-- Create user_shop table
CREATE TABLE IF NOT EXISTS "UserShop" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "roleAtShop" TEXT NOT NULL,
  CONSTRAINT fk_usershop_user FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT fk_usershop_shop FOREIGN KEY ("shopId") REFERENCES "Shop"(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserShop_user_shop_unique" ON "UserShop" ("userId", "shopId");

-- Create product_cost table
CREATE TABLE IF NOT EXISTS "ProductCost" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  price numeric(12,2) NOT NULL,
  source TEXT NOT NULL,
  "byUserId" TEXT,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ProductCost_product_idx" ON "ProductCost" ("productId");

-- Create commission_ledger table
CREATE TABLE IF NOT EXISTS "CommissionLedger" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "periodStart" timestamptz NOT NULL,
  "periodEnd" timestamptz NOT NULL,
  "grossCommission" numeric(12,2) DEFAULT 0,
  penalties numeric(12,2) DEFAULT 0,
  "netCommission" numeric(12,2) DEFAULT 0,
  detail jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- Create reconciliation and discrepancy tables
CREATE TABLE IF NOT EXISTS "Reconciliation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shopId" TEXT NOT NULL,
  day date NOT NULL,
  "ordersCount" integer NOT NULL,
  "payoutAmount" numeric(12,2) DEFAULT 0,
  variance numeric(12,2) DEFAULT 0,
  notes TEXT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_recon_shop FOREIGN KEY ("shopId") REFERENCES "Shop"(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Reconciliation_shop_day_unique" ON "Reconciliation" ("shopId", day);

CREATE TABLE IF NOT EXISTS "Discrepancy" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shopId" TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  amount numeric(12,2) DEFAULT 0,
  status TEXT DEFAULT 'OPEN',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_discrepancy_shop FOREIGN KEY ("shopId") REFERENCES "Shop"(id) ON DELETE CASCADE
);

-- Add dueAt and pickedAt to ReturnCase (table name: "ReturnCase")
ALTER TABLE "ReturnCase" ADD COLUMN IF NOT EXISTS "dueAt" timestamptz;
ALTER TABLE "ReturnCase" ADD COLUMN IF NOT EXISTS "pickedAt" timestamptz;

-- Backfill dueAt = createdAt + 7 days for existing rows where dueAt is null
UPDATE "ReturnCase" SET "dueAt" = ("createdAt" + INTERVAL '7 days') WHERE "dueAt" IS NULL;

COMMIT;

-- Notes:
-- - This migration is additive only; it does not drop/rename existing columns to keep compatibility.
-- - gen_random_uuid() requires the pgcrypto extension or similar; if not available adjust to uuid_generate_v4().
