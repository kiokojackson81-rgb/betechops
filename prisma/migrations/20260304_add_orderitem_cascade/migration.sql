-- Migration: add_orderitem_cascade
-- Purpose: make OrderCost.orderItemId and ProfitSnapshot.orderItemId cascade on delete

BEGIN;

ALTER TABLE "OrderCost" DROP CONSTRAINT IF EXISTS "OrderCost_orderItemId_fkey";
ALTER TABLE "OrderCost" ADD CONSTRAINT "OrderCost_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfitSnapshot" DROP CONSTRAINT IF EXISTS "ProfitSnapshot_orderItemId_fkey";
ALTER TABLE "ProfitSnapshot" ADD CONSTRAINT "ProfitSnapshot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
