DO $$ BEGIN
  CREATE TYPE "PosTotalsMode" AS ENUM ('NONE', 'USER', 'GLOBAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalesCommissionMode" AS ENUM ('DEFAULT_TIERS', 'JENIFFER_PRORATED', 'BRENDAH_DIRECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserCommissionConfig" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "posTotalsMode" "PosTotalsMode" NOT NULL DEFAULT 'NONE',
  "salesCommissionMode" "SalesCommissionMode" NOT NULL DEFAULT 'DEFAULT_TIERS',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserCommissionConfig_userId_key" ON "UserCommissionConfig"("userId");

DO $$ BEGIN
  ALTER TABLE "UserCommissionConfig"
    ADD CONSTRAINT "UserCommissionConfig_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

