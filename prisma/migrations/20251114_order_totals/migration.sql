-- Add cached total amount fields to JumiaOrder for instant UI totals
ALTER TABLE "JumiaOrder"
  ADD COLUMN IF NOT EXISTS "totalAmountLocalCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "totalAmountLocalValue" DOUBLE PRECISION;

-- Optional: backfill could be done with vendor data if columns already existed
-- UPDATE "JumiaOrder" SET "totalAmountLocalCurrency" = NULL, "totalAmountLocalValue" = NULL WHERE 1=0; -- placeholder noop
