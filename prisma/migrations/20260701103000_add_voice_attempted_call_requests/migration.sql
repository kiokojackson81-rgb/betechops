-- CreateEnum
ALTER TYPE "VoiceSmsNotificationType" ADD VALUE IF NOT EXISTS 'ATTEMPTED_CALL_SMS';

-- CreateTable
CREATE TABLE "VoiceCallbackRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "voiceCallId" TEXT,
    "agentId" TEXT,
    "callStartedAt" TIMESTAMP(3),
    "callEndedAt" TIMESTAMP(3),
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSentAt" TIMESTAMP(3),
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "followUpCreated" BOOLEAN NOT NULL DEFAULT false,
    "followUpTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCallbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCallbackRequest_token_key" ON "VoiceCallbackRequest"("token");

-- CreateIndex
CREATE INDEX "VoiceCallbackRequest_token_idx" ON "VoiceCallbackRequest"("token");

-- CreateIndex
CREATE INDEX "VoiceCallbackRequest_voiceCallId_idx" ON "VoiceCallbackRequest"("voiceCallId");

-- CreateIndex
CREATE INDEX "VoiceCallbackRequest_agentId_idx" ON "VoiceCallbackRequest"("agentId");

-- CreateIndex
CREATE INDEX "VoiceCallbackRequest_normalizedPhone_idx" ON "VoiceCallbackRequest"("normalizedPhone");

-- CreateIndex
CREATE INDEX "VoiceCallbackRequest_requestedAt_createdAt_idx" ON "VoiceCallbackRequest"("requestedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceCallbackRequest" ADD CONSTRAINT "VoiceCallbackRequest_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallbackRequest" ADD CONSTRAINT "VoiceCallbackRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
