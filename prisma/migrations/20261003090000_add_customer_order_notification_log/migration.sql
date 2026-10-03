CREATE TYPE "CustomerOrderNotificationEventType" AS ENUM (
  'ORDER_PLACED', 'PAYMENT_REQUESTED', 'PROCESSING', 'DISPATCHED',
  'PAYMENT_CONFIRMED', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED',
  'POD_ORDER_RECEIVED', 'POD_PAID', 'POD_DELIVERED'
);

CREATE TYPE "CustomerOrderNotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

CREATE TABLE "CustomerOrderNotificationLog" (
  "id" TEXT NOT NULL,
  "websiteOrderId" TEXT,
  "receiptId" TEXT,
  "eventType" "CustomerOrderNotificationEventType" NOT NULL,
  "channel" "CustomerOrderNotificationChannel" NOT NULL,
  "recipientName" TEXT,
  "recipientAddress" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "ProjectNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "payloadSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerOrderNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerOrderNotificationLog_idempotencyKey_key" ON "CustomerOrderNotificationLog"("idempotencyKey");
CREATE INDEX "CustomerOrderNotificationLog_websiteOrderId_createdAt_idx" ON "CustomerOrderNotificationLog"("websiteOrderId", "createdAt");
CREATE INDEX "CustomerOrderNotificationLog_receiptId_createdAt_idx" ON "CustomerOrderNotificationLog"("receiptId", "createdAt");
CREATE INDEX "CustomerOrderNotificationLog_status_createdAt_idx" ON "CustomerOrderNotificationLog"("status", "createdAt");
ALTER TABLE "CustomerOrderNotificationLog" ADD CONSTRAINT "CustomerOrderNotificationLog_websiteOrderId_fkey" FOREIGN KEY ("websiteOrderId") REFERENCES "WebsiteOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerOrderNotificationLog" ADD CONSTRAINT "CustomerOrderNotificationLog_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
