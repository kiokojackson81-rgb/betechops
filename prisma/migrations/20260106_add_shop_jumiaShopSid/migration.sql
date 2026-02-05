-- Migration: add_shop_jumiaShopSid
-- Adds a nullable `jumiaShopSid` column to the Shop table and
-- a unique index on (platform, jumiaShopSid). This migration is
-- idempotent and safe for existing data.

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "jumiaShopSid" text;

-- Postgres allows multiple NULL values in a unique index, which
-- is desired so shops without a jumiaShopSid remain valid.
CREATE UNIQUE INDEX IF NOT EXISTS "shop_platform_jumiaShopSid_unique" ON "Shop" ("platform", "jumiaShopSid");
