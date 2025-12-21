-- CreateTable
CREATE TABLE "MarketingDailyEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "totalSales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "photoUrl" TEXT,
    "tiktokPosted2Videos" BOOLEAN,
    "tiktokRepliedAll" BOOLEAN,
    "igFbYtPosted2VideosEach" BOOLEAN,
    "igFbYtRepliedAll" BOOLEAN,
    "waPostedStatus" BOOLEAN,
    "waSavedContacts" BOOLEAN,
    "waRespondedAll" BOOLEAN,
    "waPosted10Statuses" BOOLEAN,
    "waSaved10Contacts" BOOLEAN,
    "stockEnoughFastMovers" BOOLEAN,
    "shot4ProductVideos" BOOLEAN,
    "tiktokPosted4ExplanatoryVideos" BOOLEAN,
    "liveViewers" INTEGER,
    "liveSessionsCount" INTEGER,
    "liveSessionsEstimatedViewers" INTEGER,
    "liveSessionDurationMinutes" INTEGER,
    "liveSessionPlatform" TEXT,
    "shopCleaned" BOOLEAN,
    "shopWellArranged" BOOLEAN,
    "displayWellLabeled" BOOLEAN,
    "weeklyComment" TEXT,
    "payload" JSONB,
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingDailyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingDailyEntry_date_idx" ON "MarketingDailyEntry"("date");

-- CreateIndex
CREATE INDEX "MarketingDailyEntry_dayOfWeek_idx" ON "MarketingDailyEntry"("dayOfWeek");

-- CreateIndex
CREATE INDEX "MarketingDailyEntry_submittedById_idx" ON "MarketingDailyEntry"("submittedById");

-- AddForeignKey
ALTER TABLE "MarketingDailyEntry" ADD CONSTRAINT "MarketingDailyEntry_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
