CREATE TYPE "WarrantyCertificateStatus" AS ENUM ('ISSUED', 'SUPERSEDED');

CREATE TABLE "WarrantyCertificate" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "commissioningSessionId" TEXT NOT NULL,
  "certificateNo" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "WarrantyCertificateStatus" NOT NULL DEFAULT 'ISSUED',
  "verificationTokenHash" TEXT NOT NULL,
  "verificationTokenCiphertext" TEXT NOT NULL,
  "sourceCertificateNo" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedById" TEXT,
  "issuedByName" TEXT,
  "pdfUrl" TEXT NOT NULL,
  "pdfSha256" TEXT,
  "data" JSONB NOT NULL,
  "supersededAt" TIMESTAMP(3),
  "supersededById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WarrantyCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarrantyCertificate_certificateNo_key" ON "WarrantyCertificate"("certificateNo");
CREATE UNIQUE INDEX "WarrantyCertificate_verificationTokenHash_key" ON "WarrantyCertificate"("verificationTokenHash");
CREATE INDEX "WarrantyCertificate_receiptId_issuedAt_idx" ON "WarrantyCertificate"("receiptId", "issuedAt");
CREATE INDEX "WarrantyCertificate_commissioningSessionId_idx" ON "WarrantyCertificate"("commissioningSessionId");

ALTER TABLE "WarrantyCertificate"
  ADD CONSTRAINT "WarrantyCertificate_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
