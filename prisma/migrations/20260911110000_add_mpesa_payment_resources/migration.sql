-- Keep the Daraja ledger generic enough to associate an STK payment with a
-- customer Site Visit or Lipa Pole Pole agreement. Existing order relations
-- remain authoritative and are intentionally not changed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MpesaPaymentPurpose') THEN
    CREATE TYPE "MpesaPaymentPurpose" AS ENUM (
      'ORDER_PAYMENT', 'ORDER_DEPOSIT', 'ORDER_TRANSPORT', 'SITE_VISIT_FEE', 'LPP_INSTALLMENT'
    );
  END IF;
END $$;

ALTER TABLE "MpesaPayment"
  ADD COLUMN "purpose" "MpesaPaymentPurpose" NOT NULL DEFAULT 'ORDER_PAYMENT',
  ADD COLUMN "resourceType" TEXT,
  ADD COLUMN "resourceId" TEXT;

CREATE INDEX "MpesaPayment_resourceType_resourceId_status_createdAt_idx"
  ON "MpesaPayment"("resourceType", "resourceId", "status", "createdAt");
