-- Migration: add FulfillmentAudit table

BEGIN;

CREATE TABLE IF NOT EXISTS "FulfillmentAudit" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "idempotencyKey" TEXT UNIQUE,
  "shopId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  status integer NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  "s3Bucket" TEXT,
  "s3Key" TEXT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_fulfill_shop FOREIGN KEY ("shopId") REFERENCES "Shop"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "FulfillmentAudit_shop_order_idx" ON "FulfillmentAudit" ("shopId", "orderId");

COMMIT;
