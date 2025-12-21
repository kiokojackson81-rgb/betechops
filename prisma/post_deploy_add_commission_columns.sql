-- Idempotent post-deploy patch: add missing CommissionLedger columns expected by Prisma
BEGIN;

ALTER TABLE "CommissionLedger"
  ADD COLUMN IF NOT EXISTS "commissionDirect" numeric(12,2) DEFAULT 0;

ALTER TABLE "CommissionLedger"
  ADD COLUMN IF NOT EXISTS "commissionMarketplaceJumia" numeric(12,2) DEFAULT 0;

ALTER TABLE "CommissionLedger"
  ADD COLUMN IF NOT EXISTS "commissionMarketplaceKilimall" numeric(12,2) DEFAULT 0;

ALTER TABLE "CommissionLedger"
  ADD COLUMN IF NOT EXISTS "commissionTotal" numeric(12,2) DEFAULT 0;

ALTER TABLE "CommissionLedger"
  ADD COLUMN IF NOT EXISTS "commissionBreakdown" jsonb;

-- Ensure unique index exists (no-op if already present)
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionLedger_userId_periodStart_periodEnd_key"
  ON "CommissionLedger"("userId", "periodStart", "periodEnd");

COMMIT;

-- Notes:
-- This patch is safe to run multiple times. It only adds the missing columns if they do not exist.