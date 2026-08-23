-- Additive Site Visit workflow upgrade. Existing visits and historical dates are preserved.
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'STAFF';
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "feeRegion" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "standardVisitFee" DOUBLE PRECISION;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "feeOverrideReason" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentAmount" DOUBLE PRECISION;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentSubmittedAt" TIMESTAMP(3);
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentPaidAt" TIMESTAMP(3);
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentRecordedById" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentRecordedByName" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "paymentVerificationStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "waiverReason" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "waiverAuthorizedById" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "waiverAuthorizedByName" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "quotationCreditStatus" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE';
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedQuotationId" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedQuotationRef" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedAmount" DOUBLE PRECISION;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditedAt" TIMESTAMP(3);
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditAppliedById" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "creditAppliedByName" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleRequestedAt" TIMESTAMP(3);
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleRequestedDate" TIMESTAMP(3);
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleRequestedTimeLabel" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "rescheduleReason" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "cancellationRequestedAt" TIMESTAMP(3);
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

UPDATE "SiteVisit"
SET "feeRegion" = CASE
  WHEN LOWER(TRIM(COALESCE("county", ''))) LIKE 'nairobi%' THEN 'NAIROBI'
  WHEN TRIM(COALESCE("county", '')) <> '' THEN 'OUTSIDE_NAIROBI'
  ELSE NULL
END
WHERE "feeRegion" IS NULL;

UPDATE "SiteVisit"
SET "quotationCreditStatus" = CASE WHEN "paymentStatus" = 'PAID' THEN 'AVAILABLE' ELSE 'NOT_ELIGIBLE' END
WHERE "quotationCreditStatus" IS NULL OR "quotationCreditStatus" = 'NOT_ELIGIBLE';

CREATE INDEX IF NOT EXISTS "SiteVisit_source_createdAt_idx" ON "SiteVisit"("source", "createdAt");
CREATE INDEX IF NOT EXISTS "SiteVisit_paymentStatus_createdAt_idx" ON "SiteVisit"("paymentStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "SiteVisit_creditStatus_createdAt_idx" ON "SiteVisit"("quotationCreditStatus", "createdAt");
