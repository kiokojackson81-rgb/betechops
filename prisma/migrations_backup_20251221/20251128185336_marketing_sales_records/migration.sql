-- Add PaymentMethod enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MPESA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Cast totals on MarketingDailyEntry from Decimal to Integer and enforce defaults
ALTER TABLE "MarketingDailyEntry"
  ALTER COLUMN "totalSales" TYPE INTEGER USING ROUND(COALESCE("totalSales", 0)),
  ALTER COLUMN "totalSales" SET DEFAULT 0,
  ALTER COLUMN "totalSales" SET NOT NULL,
  ALTER COLUMN "totalProfit" TYPE INTEGER USING ROUND(COALESCE("totalProfit", 0)),
  ALTER COLUMN "totalProfit" SET DEFAULT 0,
  ALTER COLUMN "totalProfit" SET NOT NULL;

-- Create MarketingSale table linked to MarketingDailyEntry
CREATE TABLE IF NOT EXISTS "MarketingSale" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "buyingPrice" INTEGER NOT NULL,
  "sellingPrice" INTEGER NOT NULL,
  "receiptNumber" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingSale_pkey" PRIMARY KEY ("id")
);

-- Foreign key + index for sales
CREATE INDEX IF NOT EXISTS "MarketingSale_entryId_idx" ON "MarketingSale"("entryId");

DO $$ BEGIN
  ALTER TABLE "MarketingSale"
    ADD CONSTRAINT "MarketingSale_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MarketingDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
