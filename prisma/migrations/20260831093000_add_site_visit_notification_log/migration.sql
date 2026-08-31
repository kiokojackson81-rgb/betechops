CREATE TABLE IF NOT EXISTS "SiteVisitNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "siteVisitId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL,
  "notificationType" TEXT NOT NULL,
  "messageBody" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SiteVisitNotification_siteVisitId_createdAt_idx" ON "SiteVisitNotification"("siteVisitId","createdAt");
