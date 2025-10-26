-- Migration: add ShopAssignment table

BEGIN;

CREATE TABLE IF NOT EXISTS "ShopAssignment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  role TEXT NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_shopassignment_user FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT fk_shopassignment_shop FOREIGN KEY ("shopId") REFERENCES "Shop"(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopAssignment_user_shop_role_unique" ON "ShopAssignment" ("userId", "shopId", role);

COMMIT;
