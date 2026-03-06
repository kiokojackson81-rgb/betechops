-- Marketplace digest snapshots (store 7am + 1pm per account/day)

DO $$ BEGIN
  CREATE TYPE "MarketplaceDigestBucket" AS ENUM ('MORNING', 'MIDDAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "MarketplaceDailyOrderDigestSnapshot" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "digestDate" TIMESTAMP(3) NOT NULL,
  "bucket" "MarketplaceDigestBucket" NOT NULL,
  "newOrders" INTEGER NOT NULL DEFAULT 0,
  "pendingToday" INTEGER NOT NULL DEFAULT 0,
  "readyToShip" INTEGER NOT NULL DEFAULT 0,
  "returnedToday" INTEGER NOT NULL DEFAULT 0,
  "cancelledToday" INTEGER NOT NULL DEFAULT 0,
  "deliveredToday" INTEGER NOT NULL DEFAULT 0,
  "deliveryFailed" INTEGER NOT NULL DEFAULT 0,
  "sourceMessageId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceDailyOrderDigestSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceDailyOrderDigestSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceDailyOrderDigestSnapshot_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "MarketplaceEmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceDailyOrderDigestSnapshot_accountId_platform_digestDate_bucket_key"
  ON "MarketplaceDailyOrderDigestSnapshot"("accountId", "platform", "digestDate", "bucket");

CREATE INDEX IF NOT EXISTS "MarketplaceDailyOrderDigestSnapshot_platform_digestDate_bucket_idx"
  ON "MarketplaceDailyOrderDigestSnapshot"("platform", "digestDate", "bucket");

CREATE INDEX IF NOT EXISTS "MarketplaceDailyOrderDigestSnapshot_accountId_digestDate_idx"
  ON "MarketplaceDailyOrderDigestSnapshot"("accountId", "digestDate");

