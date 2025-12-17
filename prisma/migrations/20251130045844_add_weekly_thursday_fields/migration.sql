/*
  Warnings:

  - Made the column `itemsCount` on table `MarketingSale` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MarketingDailyEntry" ADD COLUMN     "weeklyMeetingAttended" BOOLEAN DEFAULT false,
ADD COLUMN     "weeklyVideoCount" INTEGER DEFAULT 0,
ADD COLUMN     "weeklyVideoShootParticipated" BOOLEAN DEFAULT false;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'MarketingReceipt'
  ) THEN
    ALTER TABLE "MarketingReceipt" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
    ALTER COLUMN "updatedAt" DROP DEFAULT,
    ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'MarketingReceiptItem'
  ) THEN
    ALTER TABLE "MarketingReceiptItem" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
    ALTER COLUMN "updatedAt" DROP DEFAULT,
    ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'MarketingSale'
      AND column_name = 'itemsCount'
  ) THEN
    ALTER TABLE "MarketingSale" ALTER COLUMN "itemsCount" SET NOT NULL;
  END IF;
END $$;
