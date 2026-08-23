-- Preserve the applied location pricing used when each Site Visit is created.
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "serviceZone" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "serviceZoneLabel" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "locationCounty" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "locationTown" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "appliedFee" DOUBLE PRECISION;

-- Historical fees are copied, not recalculated under the new three-zone policy.
UPDATE "SiteVisit"
SET "locationCounty" = COALESCE("locationCounty", "county"),
    "locationTown" = COALESCE("locationTown", "town"),
    "appliedFee" = COALESCE("appliedFee", "visitFee")
WHERE "locationCounty" IS NULL OR "locationTown" IS NULL OR "appliedFee" IS NULL;

CREATE INDEX IF NOT EXISTS "SiteVisit_serviceZone_createdAt_idx" ON "SiteVisit"("serviceZone", "createdAt");
