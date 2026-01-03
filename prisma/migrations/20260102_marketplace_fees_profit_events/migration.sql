BEGIN;

-- Add sellerFee and shippingFee to MarketplaceOrder
ALTER TABLE "MarketplaceOrder"
  ADD COLUMN IF NOT EXISTS "sellerFee" numeric(14,2);

ALTER TABLE "MarketplaceOrder"
  ADD COLUMN IF NOT EXISTS "shippingFee" numeric(14,2);

-- Create ProfitEvent table (simple text 'type' to avoid enum dependency)
CREATE TABLE IF NOT EXISTS "ProfitEvent" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "marketplaceOrderId" text NOT NULL,
  "type" text NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ProfitEvent_marketplaceOrder_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProfitEvent_marketplaceOrderId_idx" ON "ProfitEvent"("marketplaceOrderId");

COMMIT;
