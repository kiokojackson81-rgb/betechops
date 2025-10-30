-- Minimal patch to ensure Shop table exists with required columns for seeding
-- Safe to run multiple times

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Shop'
  ) THEN
    CREATE TABLE "Shop" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "location" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Add missing columns if not present
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'JUMIA';
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "credentialsEncrypted" JSONB;

-- Touch updatedAt default to ensure it exists
ALTER TABLE "Shop" ALTER COLUMN "updatedAt" SET DEFAULT now();
