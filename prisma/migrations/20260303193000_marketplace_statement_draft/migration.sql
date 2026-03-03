CREATE TABLE "MarketplaceStatementDraft" (
  "id" TEXT NOT NULL,
  "draftKey" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "shopId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "weekStart" TIMESTAMPTZ(0) NOT NULL,
  "weekEnd" TIMESTAMPTZ(3) NOT NULL,
  "periodKey" TEXT NOT NULL,
  "statementNumber" TEXT,
  "fileName" TEXT,
  "rowCount" INTEGER NOT NULL,
  "totalNetPayout" DECIMAL(14,2) NOT NULL,
  "rows" JSONB NOT NULL,
  "buyingByTxn" JSONB,
  "submittedByTxn" JSONB,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStatementDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceStatementDraft_draftKey_key" ON "MarketplaceStatementDraft"("draftKey");
CREATE INDEX "MarketplaceStatementDraft_shopId_weekStart_idx" ON "MarketplaceStatementDraft"("shopId","weekStart");
CREATE INDEX "MarketplaceStatementDraft_accountId_weekStart_idx" ON "MarketplaceStatementDraft"("accountId","weekStart");

ALTER TABLE "MarketplaceStatementDraft"
ADD CONSTRAINT "MarketplaceStatementDraft_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceStatementDraft"
ADD CONSTRAINT "MarketplaceStatementDraft_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceStatementDraft"
ADD CONSTRAINT "MarketplaceStatementDraft_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

