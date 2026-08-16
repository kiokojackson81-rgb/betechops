ALTER TABLE "LipaPolePole"
ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;

ALTER TABLE "LipaPolePolePayment"
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verifiedById" TEXT,
ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

UPDATE "LipaPolePolePayment"
SET "verifiedAt" = COALESCE("verifiedAt", "receivedAt")
WHERE "status" = 'SUCCESS';

CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePolePayment_mpesa_reference_key"
ON "LipaPolePolePayment" (UPPER(BTRIM("reference")))
WHERE "method" = 'MPESA' AND "reference" IS NOT NULL AND BTRIM("reference") <> '';
