DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MpesaPaymentChannel') THEN
    CREATE TYPE "MpesaPaymentChannel" AS ENUM ('STK', 'C2B');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MpesaPaymentStatus') THEN
    CREATE TYPE "MpesaPaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'UNMATCHED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MpesaPayment" (
  "id" TEXT NOT NULL,
  "channel" "MpesaPaymentChannel" NOT NULL,
  "status" "MpesaPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "orderId" TEXT,
  "websiteOrderId" TEXT,
  "accountReference" TEXT,
  "requestedAmount" DECIMAL(14,2),
  "amount" DECIMAL(14,2),
  "phoneNumber" TEXT,
  "merchantRequestId" TEXT,
  "checkoutRequestId" TEXT,
  "receiptNumber" TEXT,
  "transactionId" TEXT,
  "resultCode" INTEGER,
  "resultDescription" TEXT,
  "transactionAt" TIMESTAMP(3),
  "callbackPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MpesaPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MpesaPayment_merchantRequestId_key" ON "MpesaPayment"("merchantRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "MpesaPayment_checkoutRequestId_key" ON "MpesaPayment"("checkoutRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "MpesaPayment_receiptNumber_key" ON "MpesaPayment"("receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "MpesaPayment_transactionId_key" ON "MpesaPayment"("transactionId");
CREATE INDEX IF NOT EXISTS "MpesaPayment_orderId_status_createdAt_idx" ON "MpesaPayment"("orderId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MpesaPayment_websiteOrderId_status_createdAt_idx" ON "MpesaPayment"("websiteOrderId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MpesaPayment_accountReference_status_createdAt_idx" ON "MpesaPayment"("accountReference", "status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MpesaPayment_orderId_fkey' AND table_name = 'MpesaPayment') THEN
    ALTER TABLE "MpesaPayment" ADD CONSTRAINT "MpesaPayment_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MpesaPayment_websiteOrderId_fkey' AND table_name = 'MpesaPayment') THEN
    ALTER TABLE "MpesaPayment" ADD CONSTRAINT "MpesaPayment_websiteOrderId_fkey"
      FOREIGN KEY ("websiteOrderId") REFERENCES "WebsiteOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
