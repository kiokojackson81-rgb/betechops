DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MpesaRefundStatus') THEN
    CREATE TYPE "MpesaRefundStatus" AS ENUM ('DRAFT', 'OTP_PENDING', 'AUTHORIZED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MpesaRefund" (
  "id" TEXT NOT NULL,
  "originalPaymentId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "MpesaRefundStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT NOT NULL,
  "originalPayerPhone" TEXT NOT NULL,
  "otpHash" TEXT,
  "otpExpiresAt" TIMESTAMP(3),
  "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  "otpLastSentAt" TIMESTAMP(3),
  "requestedById" TEXT NOT NULL,
  "authorizedById" TEXT,
  "authorizedAt" TIMESTAMP(3),
  "processingAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "providerConversationId" TEXT,
  "providerOriginatorId" TEXT,
  "providerResultCode" INTEGER,
  "providerResultDesc" TEXT,
  "requestPayload" JSONB,
  "callbackPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MpesaRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MpesaRefund_providerConversationId_key" ON "MpesaRefund"("providerConversationId");
CREATE UNIQUE INDEX IF NOT EXISTS "MpesaRefund_providerOriginatorId_key" ON "MpesaRefund"("providerOriginatorId");
CREATE INDEX IF NOT EXISTS "MpesaRefund_originalPaymentId_status_idx" ON "MpesaRefund"("originalPaymentId", "status");
CREATE INDEX IF NOT EXISTS "MpesaRefund_status_createdAt_idx" ON "MpesaRefund"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MpesaRefund_requestedById_createdAt_idx" ON "MpesaRefund"("requestedById", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MpesaRefund_originalPaymentId_fkey' AND table_name = 'MpesaRefund') THEN
    ALTER TABLE "MpesaRefund" ADD CONSTRAINT "MpesaRefund_originalPaymentId_fkey"
      FOREIGN KEY ("originalPaymentId") REFERENCES "MpesaPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MpesaRefund_requestedById_fkey' AND table_name = 'MpesaRefund') THEN
    ALTER TABLE "MpesaRefund" ADD CONSTRAINT "MpesaRefund_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MpesaRefund_authorizedById_fkey' AND table_name = 'MpesaRefund') THEN
    ALTER TABLE "MpesaRefund" ADD CONSTRAINT "MpesaRefund_authorizedById_fkey"
      FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
