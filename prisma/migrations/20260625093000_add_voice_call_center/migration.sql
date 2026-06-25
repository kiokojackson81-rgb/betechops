CREATE TABLE "VoiceCall" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "destinationNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "routedTo" TEXT,
    "routeType" TEXT,
    "assignedToId" TEXT,
    "customerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationInSeconds" INTEGER,
    "currencyCode" TEXT,
    "amount" DECIMAL(12,2),
    "recordingUrl" TEXT,
    "menuOption" TEXT,
    "notes" TEXT,
    "rawPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceEvent" (
    "id" TEXT NOT NULL,
    "voiceCallId" TEXT,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceLead" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedToId" TEXT,
    "customerId" TEXT,
    "lastCallAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoiceCall_sessionId_key" ON "VoiceCall"("sessionId");
CREATE INDEX "VoiceCall_status_createdAt_idx" ON "VoiceCall"("status", "createdAt");
CREATE INDEX "VoiceCall_isActive_createdAt_idx" ON "VoiceCall"("isActive", "createdAt");
CREATE INDEX "VoiceCall_assignedToId_createdAt_idx" ON "VoiceCall"("assignedToId", "createdAt");
CREATE INDEX "VoiceCall_callerNumber_createdAt_idx" ON "VoiceCall"("callerNumber", "createdAt");

CREATE INDEX "VoiceEvent_sessionId_createdAt_idx" ON "VoiceEvent"("sessionId", "createdAt");
CREATE INDEX "VoiceEvent_voiceCallId_createdAt_idx" ON "VoiceEvent"("voiceCallId", "createdAt");

CREATE INDEX "VoiceLead_phone_createdAt_idx" ON "VoiceLead"("phone", "createdAt");
CREATE INDEX "VoiceLead_status_createdAt_idx" ON "VoiceLead"("status", "createdAt");
CREATE INDEX "VoiceLead_assignedToId_status_idx" ON "VoiceLead"("assignedToId", "status");

ALTER TABLE "VoiceCall"
ADD CONSTRAINT "VoiceCall_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VoiceCall"
ADD CONSTRAINT "VoiceCall_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VoiceEvent"
ADD CONSTRAINT "VoiceEvent_voiceCallId_fkey"
FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VoiceLead"
ADD CONSTRAINT "VoiceLead_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VoiceLead"
ADD CONSTRAINT "VoiceLead_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
