-- Migration: add_pricedAt_fields
-- Adds nullable pricedAt timestamps to MarketingSale and SupportReceiptItem

ALTER TABLE "MarketingSale"
  ADD COLUMN IF NOT EXISTS "pricedAt" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS "MarketingSale_pricedAt_idx" ON "MarketingSale" ("pricedAt");

ALTER TABLE "SupportReceiptItem"
  ADD COLUMN IF NOT EXISTS "pricedAt" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS "SupportReceiptItem_pricedAt_idx" ON "SupportReceiptItem" ("pricedAt");
