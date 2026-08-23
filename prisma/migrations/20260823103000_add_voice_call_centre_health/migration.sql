CREATE TABLE "VoiceCallCentreHealth" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "consecutiveBusy" INTEGER NOT NULL DEFAULT 0,
    "lastEvaluatedTerminalId" TEXT,
    "lastEvaluatedTerminalStatus" TEXT,
    "lastBusyCallId" TEXT,
    "lastInboundCallId" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastAnsweredCallId" TEXT,
    "lastAnsweredAt" TIMESTAMP(3),
    "busyIncidentActive" BOOLEAN NOT NULL DEFAULT false,
    "busyIncidentStartedAt" TIMESTAMP(3),
    "busyIncidentAlertId" TEXT,
    "inactivityIncidentActive" BOOLEAN NOT NULL DEFAULT false,
    "inactivityIncidentStartedAt" TIMESTAMP(3),
    "inactivityIncidentAlertId" TEXT,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "lastAlertReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoiceCallCentreHealth_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceCallCentreAlert" (
    "id" TEXT NOT NULL,
    "incidentKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "chatraceContact" TEXT,
    "issueFieldUpdated" BOOLEAN NOT NULL DEFAULT false,
    "timeFieldUpdated" BOOLEAN NOT NULL DEFAULT false,
    "tagApplied" BOOLEAN NOT NULL DEFAULT false,
    "tagAttemptedAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "associatedCallIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoiceCallCentreAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoiceCallCentreAlert_incidentKey_key" ON "VoiceCallCentreAlert"("incidentKey");
CREATE INDEX "VoiceCallCentreAlert_type_detectedAt_idx" ON "VoiceCallCentreAlert"("type", "detectedAt");
CREATE INDEX "VoiceCallCentreAlert_deliveryStatus_createdAt_idx" ON "VoiceCallCentreAlert"("deliveryStatus", "createdAt");
