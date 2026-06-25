-- CreateTable
CREATE TABLE "VoiceAgentPresence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAgentPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCallNote" (
    "id" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "customerId" TEXT,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCallNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceFollowUp" (
    "id" TEXT NOT NULL,
    "voiceCallId" TEXT,
    "voiceLeadId" TEXT,
    "customerId" TEXT,
    "assignedToId" TEXT,
    "phone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceAgentPresence_userId_key" ON "VoiceAgentPresence"("userId");

-- CreateIndex
CREATE INDEX "VoiceAgentPresence_status_updatedAt_idx" ON "VoiceAgentPresence"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "VoiceAgentPresence_currentCallId_idx" ON "VoiceAgentPresence"("currentCallId");

-- CreateIndex
CREATE INDEX "VoiceCallNote_voiceCallId_createdAt_idx" ON "VoiceCallNote"("voiceCallId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallNote_customerId_createdAt_idx" ON "VoiceCallNote"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallNote_authorId_createdAt_idx" ON "VoiceCallNote"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceFollowUp_status_updatedAt_idx" ON "VoiceFollowUp"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "VoiceFollowUp_assignedToId_status_idx" ON "VoiceFollowUp"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "VoiceFollowUp_voiceCallId_updatedAt_idx" ON "VoiceFollowUp"("voiceCallId", "updatedAt");

-- CreateIndex
CREATE INDEX "VoiceFollowUp_voiceLeadId_updatedAt_idx" ON "VoiceFollowUp"("voiceLeadId", "updatedAt");

-- CreateIndex
CREATE INDEX "VoiceFollowUp_customerId_updatedAt_idx" ON "VoiceFollowUp"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "VoiceFollowUp_phone_updatedAt_idx" ON "VoiceFollowUp"("phone", "updatedAt");

-- AddForeignKey
ALTER TABLE "VoiceAgentPresence" ADD CONSTRAINT "VoiceAgentPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceAgentPresence" ADD CONSTRAINT "VoiceAgentPresence_currentCallId_fkey" FOREIGN KEY ("currentCallId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallNote" ADD CONSTRAINT "VoiceCallNote_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallNote" ADD CONSTRAINT "VoiceCallNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallNote" ADD CONSTRAINT "VoiceCallNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceFollowUp" ADD CONSTRAINT "VoiceFollowUp_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceFollowUp" ADD CONSTRAINT "VoiceFollowUp_voiceLeadId_fkey" FOREIGN KEY ("voiceLeadId") REFERENCES "VoiceLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceFollowUp" ADD CONSTRAINT "VoiceFollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceFollowUp" ADD CONSTRAINT "VoiceFollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
