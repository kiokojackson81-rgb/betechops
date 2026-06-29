-- CreateEnum
CREATE TYPE "VoiceSmsNotificationType" AS ENUM ('MISSED_CALL_SMS', 'CALL_FEEDBACK_SMS');

-- CreateEnum
CREATE TYPE "VoiceSmsNotificationStatus" AS ENUM ('PROCESSING', 'SENT', 'FAILED', 'SKIPPED_DUPLICATE');

-- CreateTable
CREATE TABLE "VoiceSmsNotificationLog" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "normalizedPhoneNumber" TEXT NOT NULL,
    "notificationType" "VoiceSmsNotificationType" NOT NULL,
    "voiceCallId" TEXT,
    "messageBody" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "VoiceSmsNotificationStatus" NOT NULL,
    "reason" TEXT,
    "dayKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSmsNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceSmsNotificationLog_normalizedPhoneNumber_notificationT_idx" ON "VoiceSmsNotificationLog"("normalizedPhoneNumber", "notificationType", "dayKey");

-- CreateIndex
CREATE INDEX "VoiceSmsNotificationLog_voiceCallId_notificationType_idx" ON "VoiceSmsNotificationLog"("voiceCallId", "notificationType");

-- CreateIndex
CREATE INDEX "VoiceSmsNotificationLog_status_createdAt_idx" ON "VoiceSmsNotificationLog"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSmsNotificationLog_voiceCallId_notificationType_key" ON "VoiceSmsNotificationLog"("voiceCallId", "notificationType");

-- AddForeignKey
ALTER TABLE "VoiceSmsNotificationLog" ADD CONSTRAINT "VoiceSmsNotificationLog_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
