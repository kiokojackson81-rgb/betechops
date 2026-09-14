ALTER TYPE "CommissioningSessionStatus" ADD VALUE IF NOT EXISTS 'TECHNICIAN_COMPLETED';
ALTER TYPE "CommissioningSessionStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PROFESSIONAL_REVIEW';
ALTER TYPE "CommissioningSessionStatus" ADD VALUE IF NOT EXISTS 'RETURNED_FOR_CORRECTION';
ALTER TYPE "CommissioningSessionStatus" ADD VALUE IF NOT EXISTS 'PROFESSIONALLY_APPROVED';

ALTER TABLE "CommissioningSession"
  ADD COLUMN IF NOT EXISTS "technicianSignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "professionalApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "professionalReviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "professionalSignatureSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "professionalProfileSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "professionalReviewComment" TEXT;

ALTER TABLE "Branding"
  ADD COLUMN IF NOT EXISTS "licensedProfessionalName" TEXT NOT NULL DEFAULT 'Jonathan Mugiira',
  ADD COLUMN IF NOT EXISTS "licensedProfessionalTitle" TEXT NOT NULL DEFAULT 'Senior Solar PV & Electrical Engineer',
  ADD COLUMN IF NOT EXISTS "licensedProfessionalQualification" TEXT NOT NULL DEFAULT 'EPRA T3 Solar Photovoltaic Technician',
  ADD COLUMN IF NOT EXISTS "licensedProfessionalLicenceNumber" TEXT NOT NULL DEFAULT 'EPRA/SPVT/001782',
  ADD COLUMN IF NOT EXISTS "licensedProfessionalSignatureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "licensedProfessionalActive" BOOLEAN NOT NULL DEFAULT true;
