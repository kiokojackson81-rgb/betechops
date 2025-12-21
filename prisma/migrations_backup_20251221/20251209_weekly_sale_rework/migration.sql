-- WeeklySale redesign: track platform, source, approval metadata and harden constraints.

CREATE TYPE "WeeklySaleSource" AS ENUM ('AUTOMATIC', 'MANUAL');
CREATE TYPE "WeeklySaleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "WeeklySale"
    ADD COLUMN     "platform" "Platform" NOT NULL DEFAULT 'JUMIA',
    ADD COLUMN     "source" "WeeklySaleSource" NOT NULL DEFAULT 'AUTOMATIC',
    ADD COLUMN     "createdBy" TEXT,
    ADD COLUMN     "approvedBy" TEXT,
    ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WeeklySale"
    ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "WeeklySale"
    ADD COLUMN "status_new" "WeeklySaleStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "WeeklySale"
SET "status_new" = CASE
    WHEN UPPER(COALESCE("status", '')) IN ('PAID', 'APPROVED') THEN 'APPROVED'::"WeeklySaleStatus"
    WHEN UPPER(COALESCE("status", '')) = 'REJECTED' THEN 'REJECTED'::"WeeklySaleStatus"
    ELSE 'PENDING'::"WeeklySaleStatus"
END;

ALTER TABLE "WeeklySale" DROP COLUMN "status";
ALTER TABLE "WeeklySale" RENAME COLUMN "status_new" TO "status";

-- treat all historical rows as manual submissions.
UPDATE "WeeklySale" SET "source" = 'MANUAL';

-- Prefer explicit approval metadata once reviews are introduced.
ALTER TABLE "WeeklySale"
    ADD CONSTRAINT "WeeklySale_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "WeeklySale_shopId_weekStart_idx";

CREATE UNIQUE INDEX "WeeklySale_shopId_platform_weekStart_weekEnd_key"
    ON "WeeklySale"("shopId", "platform", "weekStart", "weekEnd");

CREATE INDEX "WeeklySale_shopId_platform_weekStart_weekEnd_idx"
    ON "WeeklySale"("shopId", "platform", "weekStart", "weekEnd");

-- Remove defaults we only needed for the migration step.
ALTER TABLE "WeeklySale" ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE "WeeklySale" ALTER COLUMN "source" DROP DEFAULT;
