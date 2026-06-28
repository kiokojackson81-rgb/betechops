ALTER TABLE "VoiceAgentPresence"
ADD COLUMN "dismissedPopupCallId" TEXT,
ADD COLUMN "dismissedPopupAt" TIMESTAMP(3);

CREATE INDEX "VoiceAgentPresence_dismissedPopupCallId_idx" ON "VoiceAgentPresence"("dismissedPopupCallId");
