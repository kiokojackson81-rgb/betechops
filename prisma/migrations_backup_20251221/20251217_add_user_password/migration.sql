-- Migration: add_user_password
-- Purpose: Ensure the production database has the `password` column on the "User" table.
-- This migration is intentionally minimal and uses IF NOT EXISTS to be safe to apply.

ALTER TABLE IF EXISTS "User"
ADD COLUMN IF NOT EXISTS "password" TEXT;
