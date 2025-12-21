-- Add action column to FulfillmentAudit
ALTER TABLE "FulfillmentAudit" ADD COLUMN IF NOT EXISTS "action" text;
