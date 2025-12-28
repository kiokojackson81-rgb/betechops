-- Non-destructive migration: add disableAutoSync to Shop if missing
-- This will not drop or modify existing data.

ALTER TABLE IF EXISTS "Shop" ADD COLUMN IF NOT EXISTS "disableAutoSync" boolean DEFAULT false;

-- Add any other additive, non-destructive schema changes here.
-- Review this SQL before applying to production. Use a staging branch or backup first.
