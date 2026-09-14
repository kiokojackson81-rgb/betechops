ALTER TABLE "WarrantyCertificate" ADD COLUMN "coverageStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Branding" ADD COLUMN "licensedProfessionalUserId" TEXT;
ALTER TABLE "TechnicalProfile" ADD COLUMN "signatureUrl" TEXT;
ALTER TABLE "CommissioningSession" ADD COLUMN "supervisedByProfessionalId" TEXT, ADD COLUMN "customerSignedAt" TIMESTAMP(3);
CREATE TABLE "WarrantyHistory" (
  "id" TEXT NOT NULL,
  "certificateId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data" JSONB NOT NULL,
  CONSTRAINT "WarrantyHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WarrantyHistory_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "WarrantyCertificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WarrantyHistory_certificateId_createdAt_idx" ON "WarrantyHistory"("certificateId", "createdAt");
