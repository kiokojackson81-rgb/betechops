-- Safe Receipts Migration
-- This script only creates the new enums and tables required for the receipts feature
-- It uses conditional checks so applying it to a DB that lacks some older objects will not fail.

-- Create enum DocType if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = 'doctype') THEN
    CREATE TYPE "DocType" AS ENUM ('RECEIPT', 'INVOICE', 'QUOTATION', 'LAYAWAY');
  END IF;
END$$;

-- Create enum CommissionRecordStatus if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = 'commissionrecordstatus') THEN
    CREATE TYPE "CommissionRecordStatus" AS ENUM ('PENDING', 'RELEASED');
  END IF;
END$$;

-- Add customer contact + metadata fields to Order if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Order') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'customerPhone') THEN
      ALTER TABLE "Order" ADD COLUMN "customerPhone" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'customerEmail') THEN
      ALTER TABLE "Order" ADD COLUMN "customerEmail" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'metadata') THEN
      ALTER TABLE "Order" ADD COLUMN "metadata" JSONB;
    END IF;
  END IF;
END$$;

-- Create Balance table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Balance') THEN
    CREATE TABLE "Balance" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "available" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "pending" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "Balance_userId_key" ON "Balance"("userId");
  END IF;
END$$;

-- Create CommissionRecord table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CommissionRecord') THEN
    CREATE TABLE "CommissionRecord" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "attendantId" TEXT,
      "amount" DECIMAL(14,2),
      "status" "CommissionRecordStatus" NOT NULL DEFAULT 'PENDING',
      "periodId" TEXT,
      "releasedAt" TIMESTAMP(3),
      "data" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "CommissionRecord_orderId_idx" ON "CommissionRecord"("orderId");
    -- Add FK to Order if Order exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Order') THEN
      ALTER TABLE "CommissionRecord" ADD CONSTRAINT IF NOT EXISTS "CommissionRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    -- Add FK to User (attendant) if User exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
      ALTER TABLE "CommissionRecord" ADD CONSTRAINT IF NOT EXISTS "CommissionRecord_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

-- Create Receipt table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Receipt') THEN
    CREATE TABLE "Receipt" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "docType" "DocType" NOT NULL,
      "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "issuedById" TEXT,
      "taxRate" DECIMAL(6,2),
      "discount" DECIMAL(12,2),
      "showTax" BOOLEAN NOT NULL DEFAULT false,
      "showDiscount" BOOLEAN NOT NULL DEFAULT false,
      "paymentDetailsShown" BOOLEAN NOT NULL DEFAULT false,
      "notes" TEXT,
      "warrantyText" TEXT,
      "totals" JSONB,
      "data" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_orderId_key" ON "Receipt"("orderId");
    -- FK to Order
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Order') THEN
      ALTER TABLE "Receipt" ADD CONSTRAINT IF NOT EXISTS "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    -- FK to User issuedBy
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
      ALTER TABLE "Receipt" ADD CONSTRAINT IF NOT EXISTS "Receipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

-- Create ReceiptFile table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ReceiptFile') THEN
    CREATE TABLE "ReceiptFile" (
      "id" TEXT PRIMARY KEY,
      "receiptId" TEXT NOT NULL,
      "key" TEXT,
      "url" TEXT NOT NULL,
      "contentType" TEXT,
      "size" INTEGER,
      "uploadedBy" TEXT,
      "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3)
    );
    CREATE INDEX IF NOT EXISTS "ReceiptFile_receiptId_idx" ON "ReceiptFile"("receiptId");
    -- FK to Receipt
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Receipt') THEN
      ALTER TABLE "ReceiptFile" ADD CONSTRAINT IF NOT EXISTS "ReceiptFile_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

-- Create LayawayPlan and LayawayPayment tables if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'LayawayPlan') THEN
    CREATE TABLE "LayawayPlan" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "deposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "isComplete" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "LayawayPlan_orderId_key" ON "LayawayPlan"("orderId");
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Order') THEN
      ALTER TABLE "LayawayPlan" ADD CONSTRAINT IF NOT EXISTS "LayawayPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'LayawayPayment') THEN
    CREATE TABLE "LayawayPayment" (
      "id" TEXT PRIMARY KEY,
      "planId" TEXT NOT NULL,
      "amount" DECIMAL(14,2) NOT NULL,
      "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "method" TEXT,
      "ref" TEXT
    );
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'LayawayPlan') THEN
      ALTER TABLE "LayawayPayment" ADD CONSTRAINT IF NOT EXISTS "LayawayPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LayawayPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

-- Ensure the Balance foreign key to User exists if both are present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Balance')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
    ALTER TABLE "Balance" ADD CONSTRAINT IF NOT EXISTS "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- Add indexes where helpful (only if they don't exist)
CREATE INDEX IF NOT EXISTS "ReceiptFile_receiptId_idx" ON "ReceiptFile"("receiptId");
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_orderId_key" ON "Receipt"("orderId");

-- End of safe receipts migration
