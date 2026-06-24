DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebsiteOrderStatus') THEN
    CREATE TYPE "WebsiteOrderStatus" AS ENUM (
      'PENDING',
      'CONFIRMED',
      'RECEIPT_ISSUED',
      'PROCESSING',
      'DELIVERED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebsiteOrderType') THEN
    CREATE TYPE "WebsiteOrderType" AS ENUM (
      'POD',
      'PREPAID',
      'SHOP_PICKUP',
      'QUOTE_FIRST'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WebsiteOrder" (
  "id" TEXT NOT NULL,
  "orderRef" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerLocation" TEXT NOT NULL,
  "customerEmail" TEXT,
  "deliveryMethod" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "orderType" "WebsiteOrderType" NOT NULL,
  "status" "WebsiteOrderStatus" NOT NULL DEFAULT 'PENDING',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "deliveryFee" DECIMAL(12,2),
  "total" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "source" TEXT NOT NULL DEFAULT 'WEBSITE',
  "receiptId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "confirmedById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebsiteOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebsiteOrderItem" (
  "id" TEXT NOT NULL,
  "websiteOrderId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "sku" TEXT,
  "category" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebsiteOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteOrder_orderRef_key" ON "WebsiteOrder"("orderRef");
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteOrder_receiptId_key" ON "WebsiteOrder"("receiptId");
CREATE INDEX IF NOT EXISTS "WebsiteOrder_status_createdAt_idx" ON "WebsiteOrder"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteOrder_orderType_createdAt_idx" ON "WebsiteOrder"("orderType", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteOrderItem_websiteOrderId_idx" ON "WebsiteOrderItem"("websiteOrderId");
CREATE INDEX IF NOT EXISTS "WebsiteOrderItem_productId_idx" ON "WebsiteOrderItem"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'WebsiteOrder_confirmedById_fkey'
      AND table_name = 'WebsiteOrder'
  ) THEN
    ALTER TABLE "WebsiteOrder"
      ADD CONSTRAINT "WebsiteOrder_confirmedById_fkey"
      FOREIGN KEY ("confirmedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Receipt'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'WebsiteOrder_receiptId_fkey'
      AND table_name = 'WebsiteOrder'
  ) THEN
    ALTER TABLE "WebsiteOrder"
      ADD CONSTRAINT "WebsiteOrder_receiptId_fkey"
      FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'WebsiteOrderItem_websiteOrderId_fkey'
      AND table_name = 'WebsiteOrderItem'
  ) THEN
    ALTER TABLE "WebsiteOrderItem"
      ADD CONSTRAINT "WebsiteOrderItem_websiteOrderId_fkey"
      FOREIGN KEY ("websiteOrderId") REFERENCES "WebsiteOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'WebsiteOrderItem_productId_fkey'
      AND table_name = 'WebsiteOrderItem'
  ) THEN
    ALTER TABLE "WebsiteOrderItem"
      ADD CONSTRAINT "WebsiteOrderItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
