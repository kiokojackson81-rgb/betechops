CREATE TABLE IF NOT EXISTS "VoiceAgentCompliance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NORMAL',
  "overdueCallbackCount" INTEGER NOT NULL DEFAULT 0,
  "oldestOverdueAt" TIMESTAMP(3),
  "lowRatingCount30d" INTEGER NOT NULL DEFAULT 0,
  "feedbackResponseCount30d" INTEGER NOT NULL DEFAULT 0,
  "averageRating30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qualityReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "restrictionReason" TEXT,
  "restrictedAt" TIMESTAMP(3),
  "manualRestriction" BOOLEAN NOT NULL DEFAULT false,
  "manualRestrictionReason" TEXT,
  "manualRestrictedAt" TIMESTAMP(3),
  "overrideActive" BOOLEAN NOT NULL DEFAULT false,
  "overrideReason" TEXT,
  "overrideById" TEXT,
  "overrideAt" TIMESTAMP(3),
  "overrideBaselineAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceAgentCompliance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceAgentCompliance_userId_key" ON "VoiceAgentCompliance"("userId");
CREATE INDEX IF NOT EXISTS "VoiceAgentCompliance_status_updatedAt_idx" ON "VoiceAgentCompliance"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "VoiceAgentCompliance_qualityReviewRequired_updatedAt_idx" ON "VoiceAgentCompliance"("qualityReviewRequired", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "VoiceAgentCompliance"
    ADD CONSTRAINT "VoiceAgentCompliance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VoiceComplianceEvent" (
  "id" TEXT NOT NULL,
  "complianceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceComplianceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VoiceComplianceEvent_complianceId_createdAt_idx" ON "VoiceComplianceEvent"("complianceId", "createdAt");
CREATE INDEX IF NOT EXISTS "VoiceComplianceEvent_type_createdAt_idx" ON "VoiceComplianceEvent"("type", "createdAt");

DO $$ BEGIN
  ALTER TABLE "VoiceComplianceEvent"
    ADD CONSTRAINT "VoiceComplianceEvent_complianceId_fkey"
    FOREIGN KEY ("complianceId") REFERENCES "VoiceAgentCompliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
