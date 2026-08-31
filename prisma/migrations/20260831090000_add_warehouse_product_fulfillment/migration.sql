ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "warehouseFulfillmentSource" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedDeliveryDays" TEXT,
  ADD COLUMN IF NOT EXISTS "internationalShippingCharge" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "supplierInfo" TEXT;
