CREATE TABLE "AdminCriticalSmsLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "messageBody" TEXT NOT NULL,
    "actionUrl" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "payloadSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "AdminCriticalSmsLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminCriticalSmsLog_idempotencyKey_key" ON "AdminCriticalSmsLog"("idempotencyKey");
CREATE INDEX "AdminCriticalSmsLog_eventType_createdAt_idx" ON "AdminCriticalSmsLog"("eventType", "createdAt");
CREATE INDEX "AdminCriticalSmsLog_entityId_createdAt_idx" ON "AdminCriticalSmsLog"("entityId", "createdAt");
CREATE INDEX "AdminCriticalSmsLog_status_createdAt_idx" ON "AdminCriticalSmsLog"("status", "createdAt");
