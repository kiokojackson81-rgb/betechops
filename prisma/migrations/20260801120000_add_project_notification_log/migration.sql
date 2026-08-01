-- CreateEnum
CREATE TYPE "ProjectNotificationEventType" AS ENUM ('PROJECT_BOOKED', 'PROJECT_BOOKING_UPDATED', 'PROJECT_COMPLETED');

-- CreateEnum
CREATE TYPE "ProjectNotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "ProjectNotificationRecipientType" AS ENUM ('CUSTOMER', 'ADMIN', 'ASSIGNED_HANDLER', 'COMPLETING_USER', 'PREVIOUS_HANDLER');

-- CreateEnum
CREATE TYPE "ProjectNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "ProjectNotificationLog" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "eventType" "ProjectNotificationEventType" NOT NULL,
    "channel" "ProjectNotificationChannel" NOT NULL,
    "recipientType" "ProjectNotificationRecipientType" NOT NULL,
    "recipientName" TEXT,
    "recipientAddress" TEXT,
    "templateKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ProjectNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "payloadSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectNotificationLog_idempotencyKey_key" ON "ProjectNotificationLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProjectNotificationLog_receiptId_createdAt_idx" ON "ProjectNotificationLog"("receiptId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectNotificationLog_status_createdAt_idx" ON "ProjectNotificationLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectNotificationLog_eventType_createdAt_idx" ON "ProjectNotificationLog"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectNotificationLog" ADD CONSTRAINT "ProjectNotificationLog_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
