-- Marketplace email intelligence (Gmail ingestion + digests + after-sales)

-- 1) New enums
DO $$ BEGIN
  CREATE TYPE "MarketplaceEmailParserType" AS ENUM (
    'UNKNOWN',
    'JUMIA_DAILY_REPORT',
    'JUMIA_RETURN_PICKUP',
    'KILIMALL_NEW_ORDER',
    'KILIMALL_AFTERSALES'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketplaceEmailParseStatus" AS ENUM ('SKIPPED', 'PARSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketplaceAfterSalesStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Mailboxes + OAuth
CREATE TABLE IF NOT EXISTS "MarketplaceMailbox" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceMailbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceMailbox_email_key" ON "MarketplaceMailbox"("email");

CREATE TABLE IF NOT EXISTS "MarketplaceMailboxOAuth" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "scope" TEXT,
  "tokenSource" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceMailboxOAuth_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceMailboxOAuth_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "MarketplaceMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceMailboxOAuth_mailboxId_key" ON "MarketplaceMailboxOAuth"("mailboxId");

-- 3) Raw email storage (dedupe)
CREATE TABLE IF NOT EXISTS "MarketplaceEmailMessage" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "providerMsgId" TEXT NOT NULL,
  "gmailMessageId" TEXT NOT NULL,
  "threadId" TEXT,
  "fromEmail" TEXT,
  "subject" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "snippet" TEXT,
  "rawHeaders" JSONB,
  "rawBodyHtml" TEXT,
  "rawBodyText" TEXT,
  "parserType" "MarketplaceEmailParserType" NOT NULL DEFAULT 'UNKNOWN',
  "parseStatus" "MarketplaceEmailParseStatus" NOT NULL DEFAULT 'SKIPPED',
  "parseError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceEmailMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceEmailMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "MarketplaceMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceEmailMessage_providerMsgId_key" ON "MarketplaceEmailMessage"("providerMsgId");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceEmailMessage_mailboxId_gmailMessageId_key" ON "MarketplaceEmailMessage"("mailboxId", "gmailMessageId");
CREATE INDEX IF NOT EXISTS "MarketplaceEmailMessage_mailboxId_receivedAt_idx" ON "MarketplaceEmailMessage"("mailboxId", "receivedAt");
CREATE INDEX IF NOT EXISTS "MarketplaceEmailMessage_parserType_parseStatus_idx" ON "MarketplaceEmailMessage"("parserType", "parseStatus");

-- 4) Daily order digests (Jumia counts)
CREATE TABLE IF NOT EXISTS "MarketplaceDailyOrderDigest" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "digestDate" TIMESTAMP(3) NOT NULL,
  "newOrders" INTEGER NOT NULL DEFAULT 0,
  "pendingToday" INTEGER NOT NULL DEFAULT 0,
  "readyToShip" INTEGER NOT NULL DEFAULT 0,
  "returnedToday" INTEGER NOT NULL DEFAULT 0,
  "cancelledToday" INTEGER NOT NULL DEFAULT 0,
  "deliveredToday" INTEGER NOT NULL DEFAULT 0,
  "deliveryFailed" INTEGER NOT NULL DEFAULT 0,
  "sourceMessageId" TEXT,
  "lastReceivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceDailyOrderDigest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceDailyOrderDigest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceDailyOrderDigest_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "MarketplaceEmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceDailyOrderDigest_accountId_platform_digestDate_key" ON "MarketplaceDailyOrderDigest"("accountId", "platform", "digestDate");
CREATE INDEX IF NOT EXISTS "MarketplaceDailyOrderDigest_platform_digestDate_idx" ON "MarketplaceDailyOrderDigest"("platform", "digestDate");

-- 5) Order events (future-ready)
CREATE TABLE IF NOT EXISTS "MarketplaceOrderEvent" (
  "id" TEXT NOT NULL,
  "marketplaceOrderId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "status" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceMessageId" TEXT,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOrderEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceOrderEvent_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceOrderEvent_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "MarketplaceEmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceOrderEvent_marketplaceOrderId_status_key" ON "MarketplaceOrderEvent"("marketplaceOrderId", "status");
CREATE INDEX IF NOT EXISTS "MarketplaceOrderEvent_marketplaceOrderId_occurredAt_idx" ON "MarketplaceOrderEvent"("marketplaceOrderId", "occurredAt");

-- 6) After-sales threads (Kilimall)
CREATE TABLE IF NOT EXISTS "MarketplaceAfterSalesThread" (
  "id" TEXT NOT NULL,
  "accountId" TEXT,
  "platform" "Platform" NOT NULL DEFAULT 'KILIMALL',
  "mailboxId" TEXT NOT NULL,
  "sourceMessageId" TEXT NOT NULL,
  "subject" TEXT,
  "fromEmail" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "status" "MarketplaceAfterSalesStatus" NOT NULL DEFAULT 'OPEN',
  "keywords" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceAfterSalesThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceAfterSalesThread_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceAfterSalesThread_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "MarketplaceMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceAfterSalesThread_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "MarketplaceEmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceAfterSalesThread_sourceMessageId_key" ON "MarketplaceAfterSalesThread"("sourceMessageId");
CREATE INDEX IF NOT EXISTS "MarketplaceAfterSalesThread_platform_status_receivedAt_idx" ON "MarketplaceAfterSalesThread"("platform", "status", "receivedAt");
CREATE INDEX IF NOT EXISTS "MarketplaceAfterSalesThread_accountId_status_idx" ON "MarketplaceAfterSalesThread"("accountId", "status");

-- 7) Extend existing tables for mapping + audit
ALTER TABLE "MarketplaceAccount"
  ADD COLUMN IF NOT EXISTS "primaryInboxEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "forwarderEmails" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "MarketplaceReturn"
  ADD COLUMN IF NOT EXISTS "rawPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "sourceEmailMessageId" TEXT;

DO $$ BEGIN
  ALTER TABLE "MarketplaceReturn"
    ADD CONSTRAINT "MarketplaceReturn_sourceEmailMessageId_fkey"
    FOREIGN KEY ("sourceEmailMessageId") REFERENCES "MarketplaceEmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "MarketplaceReturn_sourceEmailMessageId_idx" ON "MarketplaceReturn"("sourceEmailMessageId");
