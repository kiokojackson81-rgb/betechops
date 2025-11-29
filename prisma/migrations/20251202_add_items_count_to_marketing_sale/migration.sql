-- Add itemsCount to MarketingSale to capture receipts with multiple items
ALTER TABLE "MarketingSale" ADD COLUMN IF NOT EXISTS "itemsCount" INTEGER NOT NULL DEFAULT 1;
