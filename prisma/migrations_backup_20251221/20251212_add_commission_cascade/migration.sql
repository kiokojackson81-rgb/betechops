-- Make CommissionEarning.orderItemId foreign key cascade on delete

-- Drop existing FK constraint if it exists, then recreate with ON DELETE CASCADE
ALTER TABLE "CommissionEarning" DROP CONSTRAINT IF EXISTS "CommissionEarning_orderItemId_fkey";

ALTER TABLE "CommissionEarning"
  ADD CONSTRAINT "CommissionEarning_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE;
