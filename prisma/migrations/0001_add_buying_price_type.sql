-- Manual migration: add buyingPriceType enum and column to Product
-- Run with: psql $DATABASE_URL -f prisma/migrations/0001_add_buying_price_type.sql

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'buyingpricetype') THEN
        CREATE TYPE "BuyingPriceType" AS ENUM ('FIXED','VARIABLE');
    END IF;
END $$;

ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "buyingPriceType" "BuyingPriceType" NOT NULL DEFAULT 'FIXED';

-- Backfill existing products to FIXED explicitly (optional)
UPDATE "Product" SET "buyingPriceType" = 'FIXED' WHERE "buyingPriceType" IS NULL;
