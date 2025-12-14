-- Add itemsCount to MarketingSale if it does not already exist
ALTER TABLE IF EXISTS "MarketingSale"
ADD COLUMN IF NOT EXISTS "itemsCount" INTEGER DEFAULT 1;
