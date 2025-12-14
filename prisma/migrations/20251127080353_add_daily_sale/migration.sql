-- CreateTable
CREATE TABLE "DailySale" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailySale_dailyReportId_idx" ON "DailySale"("dailyReportId");

-- AddForeignKey
ALTER TABLE "DailySale" ADD CONSTRAINT "DailySale_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
