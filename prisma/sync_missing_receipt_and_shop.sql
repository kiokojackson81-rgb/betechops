-- Create Receipt table if missing (matches Prisma model fields used by app)
CREATE TABLE IF NOT EXISTS "Receipt" (
  id TEXT PRIMARY KEY,
  "orderId" TEXT UNIQUE NOT NULL,
  receipt_number TEXT UNIQUE,
  "docType" TEXT NOT NULL,
  "generatedAt" TIMESTAMPTZ DEFAULT now(),
  "issuedById" TEXT,
  "taxRate" NUMERIC(6,2),
  "discount" NUMERIC(12,2),
  "showTax" BOOLEAN DEFAULT false,
  "showDiscount" BOOLEAN DEFAULT false,
  "paymentDetailsShown" BOOLEAN DEFAULT false,
  notes TEXT,
  "warrantyText" TEXT,
  totals JSONB,
  data JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_receipt_order') THEN
    ALTER TABLE "Receipt" ADD CONSTRAINT fk_receipt_order FOREIGN KEY ("orderId") REFERENCES "Order"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_receipt_issuedby') THEN
    ALTER TABLE "Receipt" ADD CONSTRAINT fk_receipt_issuedby FOREIGN KEY ("issuedById") REFERENCES "User"(id);
  END IF;
END$$;

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "jumiaShopSid" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'shop_platform_jumiasid_unique'
  ) THEN
    CREATE UNIQUE INDEX shop_platform_jumiasid_unique ON "Shop" ("platform", "jumiaShopSid");
  END IF;
END$$;
