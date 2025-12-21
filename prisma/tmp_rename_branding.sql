DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Branding' AND column_name='brandcolor'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."Branding" RENAME COLUMN brandcolor TO "brandColor"';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Branding' AND column_name='letterheadurl'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."Branding" RENAME COLUMN letterheadurl TO "letterheadUrl"';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Branding' AND column_name='logourl'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."Branding" RENAME COLUMN logourl TO "logoUrl"';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Branding' AND column_name='updatedat'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."Branding" RENAME COLUMN updatedat TO "updatedAt"';
  END IF;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Branding' AND column_name='letterheadUrl'
  ) THEN
    EXECUTE 'UPDATE "public"."Branding" SET "letterheadUrl" = ''/letterhead.jpg'' WHERE "letterheadUrl" IS NULL';
    EXECUTE 'ALTER TABLE "public"."Branding" ALTER COLUMN "letterheadUrl" SET NOT NULL';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Branding' AND column_name='updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."Branding" ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt"';
  END IF;
END
$$ LANGUAGE plpgsql;
