DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Platform') THEN
    CREATE TYPE "Platform" AS ENUM ('JUMIA','KILIMALL');
  END IF;
END $$;

ALTER TABLE "Shop" ALTER COLUMN "platform" TYPE "Platform" USING ("platform"::"Platform");
ALTER TABLE "Shop" ALTER COLUMN "platform" SET DEFAULT 'JUMIA'::"Platform";
