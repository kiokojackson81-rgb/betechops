CREATE TABLE "CareerApplication" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "currentLocation" TEXT NOT NULL,
  "educationLevel" TEXT NOT NULL,
  "courseOfStudy" TEXT NOT NULL,
  "graduationStatus" TEXT NOT NULL,
  "cvFileUrl" TEXT NOT NULL,
  "cvFileKey" TEXT,
  "cvFileName" TEXT NOT NULL,
  "cvContentType" TEXT,
  "cvFileSize" INTEGER,
  "coverLetter" TEXT NOT NULL,
  "tiktokWorkUrl" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "applicantEmailSentAt" TIMESTAMP(3),
  "hrEmailSentAt" TIMESTAMP(3),
  "emailError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareerApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareerApplication_createdAt_idx" ON "CareerApplication"("createdAt");
CREATE INDEX "CareerApplication_status_createdAt_idx" ON "CareerApplication"("status", "createdAt");
CREATE INDEX "CareerApplication_email_idx" ON "CareerApplication"("email");