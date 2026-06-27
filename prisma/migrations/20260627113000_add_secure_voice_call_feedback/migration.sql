-- CreateTable
CREATE TABLE "VoiceCallFeedback" (
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
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER,
    "serviceType" TEXT,
    "staffHelpful" TEXT,
    "questionsAnswered" TEXT,
    "wouldRecommend" TEXT,
    "comment" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "wantsContact" BOOLEAN NOT NULL DEFAULT false,
    "followUpCreated" BOOLEAN NOT NULL DEFAULT false,
    "followUpTaskId" TEXT,

    CONSTRAINT "VoiceCallFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCallFeedback_token_key" ON "VoiceCallFeedback"("token");

-- CreateIndex
CREATE INDEX "VoiceCallFeedback_phoneNumber_idx" ON "VoiceCallFeedback"("phoneNumber");

-- CreateIndex
CREATE INDEX "VoiceCallFeedback_normalizedPhone_idx" ON "VoiceCallFeedback"("normalizedPhone");

-- CreateIndex
CREATE INDEX "VoiceCallFeedback_voiceCallId_idx" ON "VoiceCallFeedback"("voiceCallId");

-- CreateIndex
CREATE INDEX "VoiceCallFeedback_agentId_idx" ON "VoiceCallFeedback"("agentId");

-- CreateIndex
CREATE INDEX "VoiceCallFeedback_token_idx" ON "VoiceCallFeedback"("token");

-- CreateIndex
CREATE INDEX "VoiceCallFeedback_submitted_createdAt_idx" ON "VoiceCallFeedback"("submitted", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceCallFeedback" ADD CONSTRAINT "VoiceCallFeedback_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallFeedback" ADD CONSTRAINT "VoiceCallFeedback_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
