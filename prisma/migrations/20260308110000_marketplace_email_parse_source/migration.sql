DO $$ BEGIN
  CREATE TYPE "MarketplaceEmailParseSource" AS ENUM ('RULE_BASED', 'AI_FALLBACK', 'AI_FALLBACK_FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "MarketplaceEmailMessage"
  ADD COLUMN IF NOT EXISTS "parseSource" "MarketplaceEmailParseSource" NOT NULL DEFAULT 'RULE_BASED';

