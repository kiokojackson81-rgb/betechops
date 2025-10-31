-- Roll back Shop.platform to TEXT and remove custom enum type if unused
-- Idempotent: safe to run multiple times

-- 1) Ensure Shop.platform is TEXT with default 'JUMIA'
DO $$
BEGIN
  -- Only proceed if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Shop' AND column_name = 'platform'
  ) THEN
    -- Drop default first to avoid cast issues
    BEGIN
      ALTER TABLE "Shop" ALTER COLUMN "platform" DROP DEFAULT;
    EXCEPTION WHEN others THEN
      -- ignore
      NULL;
    END;

    -- Cast to TEXT no matter the current type (enum/text)
    BEGIN
      ALTER TABLE "Shop"
        ALTER COLUMN "platform" TYPE TEXT
        USING ("platform"::text);
    EXCEPTION WHEN others THEN
      -- ignore; if already TEXT this will fail harmlessly
      NULL;
    END;

    -- Restore default
    BEGIN
      ALTER TABLE "Shop" ALTER COLUMN "platform" SET DEFAULT 'JUMIA';
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

-- 2) Drop custom enum type betechops_ops.Platform if it exists and is now unused
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Platform' AND n.nspname = 'betechops_ops'
  ) THEN
    BEGIN
      EXECUTE 'DROP TYPE "betechops_ops"."Platform"';
    EXCEPTION WHEN others THEN
      -- If still referenced somewhere unknown, leave it
      NULL;
    END;
  END IF;
END $$;

-- 3) Drop schema betechops_ops if it exists and is empty
DO $$
BEGIN
  PERFORM 1 FROM pg_namespace WHERE nspname='betechops_ops';
  IF FOUND THEN
    BEGIN
      EXECUTE 'DROP SCHEMA betechops_ops RESTRICT';
    EXCEPTION WHEN others THEN
      -- Not empty or other issue; ignore
      NULL;
    END;
  END IF;
END $$;
