-- Add manual weekly sales aggregation support.

-- Add disableAutoSync flag to shops so sync jobs can skip manual stores.
ALTER TABLE "Shop"
ADD COLUMN "disableAutoSync" BOOLEAN NOT NULL DEFAULT false;

-- WeeklySale aggregates attendant totals per Monday→Saturday week.
CREATE TABLE "WeeklySale" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklySale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklySale_shopId_weekStart_idx"
    ON "WeeklySale"("shopId", "weekStart");

ALTER TABLE "WeeklySale"
    ADD CONSTRAINT "WeeklySale_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklySale"
    ADD CONSTRAINT "WeeklySale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
