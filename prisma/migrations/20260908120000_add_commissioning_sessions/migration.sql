DO $$ BEGIN
  CREATE TYPE "CommissioningSessionStatus" AS ENUM ('DRAFT', 'ISSUED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CommissioningSession" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "technicianId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "tokenCiphertext" TEXT NOT NULL,
  "customerTokenHash" TEXT,
  "customerTokenCiphertext" TEXT,
  "status" "CommissioningSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "lastStep" TEXT NOT NULL DEFAULT 'panel-identification',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "data" JSONB,
  "audit" JSONB,
  "certificateNo" TEXT,
  "issuedAt" TIMESTAMP(3),
  "customerDeliveredAt" TIMESTAMP(3),
  "customerAcknowledgedAt" TIMESTAMP(3),
  "customerTermsAcceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissioningSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommissioningSession_receiptId_key" ON "CommissioningSession"("receiptId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommissioningSession_tokenHash_key" ON "CommissioningSession"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "CommissioningSession_customerTokenHash_key" ON "CommissioningSession"("customerTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "CommissioningSession_certificateNo_key" ON "CommissioningSession"("certificateNo");
CREATE INDEX IF NOT EXISTS "CommissioningSession_technicianId_idx" ON "CommissioningSession"("technicianId");
CREATE INDEX IF NOT EXISTS "CommissioningSession_status_expiresAt_idx" ON "CommissioningSession"("status", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "CommissioningSession"
    ADD CONSTRAINT "CommissioningSession_receiptId_fkey"
    FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommissioningSession"
    ADD CONSTRAINT "CommissioningSession_technicianId_fkey"
    FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
