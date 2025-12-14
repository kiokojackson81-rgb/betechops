/*
  Warnings:

  - Made the column `itemsCount` on table `MarketingSale` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MarketingDailyEntry" ADD COLUMN     "weeklyMeetingAttended" BOOLEAN DEFAULT false,
ADD COLUMN     "weeklyVideoCount" INTEGER DEFAULT 0,
ADD COLUMN     "weeklyVideoShootParticipated" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "MarketingReceipt" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MarketingReceiptItem" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MarketingSale" ALTER COLUMN "itemsCount" SET NOT NULL;
