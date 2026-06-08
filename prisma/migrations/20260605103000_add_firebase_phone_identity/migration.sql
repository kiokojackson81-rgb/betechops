ALTER TABLE "User"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "county" TEXT,
  ADD COLUMN IF NOT EXISTS "town" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLoginMethod" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_phone_key'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_phone_key" UNIQUE ("phone");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AgentSale'
  ) THEN
    ALTER TABLE "AgentSale"
      ADD COLUMN IF NOT EXISTS "customerUserId" TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentSale_customerUserId_fkey'
    ) THEN
      ALTER TABLE "AgentSale"
        ADD CONSTRAINT "AgentSale_customerUserId_fkey"
        FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AgentSale'
  ) THEN
    CREATE INDEX IF NOT EXISTS "AgentSale_customerUserId_idx"
      ON "AgentSale"("customerUserId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AgentLeadOwnership'
  ) THEN
    ALTER TABLE "AgentLeadOwnership"
      ADD COLUMN IF NOT EXISTS "customerUserId" TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentLeadOwnership_customerUserId_fkey'
    ) THEN
      ALTER TABLE "AgentLeadOwnership"
        ADD CONSTRAINT "AgentLeadOwnership_customerUserId_fkey"
        FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AgentLeadOwnership'
  ) THEN
    CREATE INDEX IF NOT EXISTS "AgentLeadOwnership_customerUserId_idx"
      ON "AgentLeadOwnership"("customerUserId");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'WebsiteOrder'
  ) THEN
    ALTER TABLE "WebsiteOrder"
      ADD COLUMN IF NOT EXISTS "customerUserId" TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'WebsiteOrder_customerUserId_fkey'
    ) THEN
      ALTER TABLE "WebsiteOrder"
        ADD CONSTRAINT "WebsiteOrder_customerUserId_fkey"
        FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    CREATE INDEX IF NOT EXISTS "WebsiteOrder_customerUserId_createdAt_idx"
      ON "WebsiteOrder"("customerUserId", "createdAt");
  END IF;
END $$;
