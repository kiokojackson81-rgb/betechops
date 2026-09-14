ALTER TABLE "CommissioningSession"
 ADD COLUMN "completionPdfUrl" TEXT,
 ADD COLUMN "completionPdfSha256" TEXT,
 ADD COLUMN "projectReceiptPdfUrl" TEXT,
 ADD COLUMN "projectReceiptPdfSha256" TEXT,
 ADD COLUMN "documentsReadyAt" TIMESTAMP(3),
 ADD COLUMN "documentsPreparingAt" TIMESTAMP(3),
 ADD COLUMN "documentsError" TEXT;
CREATE TABLE "CommissioningSmsLog" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "sessionId" TEXT NOT NULL REFERENCES "CommissioningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "kind" TEXT NOT NULL,
 "recipientName" TEXT NOT NULL,
 "phone" TEXT NOT NULL,
 "message" TEXT NOT NULL,
 "idempotencyKey" TEXT NOT NULL UNIQUE,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "providerId" TEXT,
 "error" TEXT,
 "actorId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sentAt" TIMESTAMP(3)
);
CREATE INDEX "CommissioningSmsLog_sessionId_createdAt_idx" ON "CommissioningSmsLog"("sessionId", "createdAt");
