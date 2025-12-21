-- Create Branding table
CREATE TABLE "public"."Branding" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "letterheadUrl" TEXT NOT NULL,
  "logoUrl" TEXT,
  "brandColor" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Branding_name_key" ON "public"."Branding" ("name");
