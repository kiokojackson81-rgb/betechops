-- CreateTable
CREATE TABLE "MarketplaceOperatingCapitalWeek" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "accountId" TEXT,
    "weekStart" TIMESTAMPTZ(0) NOT NULL,
    "weekEnd" TIMESTAMPTZ(3) NOT NULL,
    "periodKey" TEXT NOT NULL,
    "profitAmount" DECIMAL(14,2) NOT NULL,
    "currentNetPayout" DECIMAL(14,2) NOT NULL,
    "operatingCapital" DECIMAL(14,2) NOT NULL,
    "adjustedNetPayout" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FINAL',
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceOperatingCapitalWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOperatingCapitalWeek_scopeKey_key" ON "MarketplaceOperatingCapitalWeek"("scopeKey");

-- CreateIndex
CREATE INDEX "MarketplaceOperatingCapitalWeek_weekStart_status_idx" ON "MarketplaceOperatingCapitalWeek"("weekStart", "status");

-- CreateIndex
CREATE INDEX "MarketplaceOperatingCapitalWeek_accountId_weekStart_idx" ON "MarketplaceOperatingCapitalWeek"("accountId", "weekStart");

-- AddForeignKey
ALTER TABLE "MarketplaceOperatingCapitalWeek" ADD CONSTRAINT "MarketplaceOperatingCapitalWeek_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
