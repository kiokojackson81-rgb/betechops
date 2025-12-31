-- Migration: add receipt_number to Receipt (safe, idempotent)
BEGIN;

ALTER TABLE IF EXISTS public."Receipt" ADD COLUMN IF NOT EXISTS receipt_number text;
-- create unique index only if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'uniq_receipt_number'
  ) THEN
    CREATE UNIQUE INDEX uniq_receipt_number ON public."Receipt"(receipt_number);
  END IF;
END$$;

-- Backfill from Order.orderNumber where possible
UPDATE public."Receipt" r
SET receipt_number = o."orderNumber"
FROM public."Order" o
WHERE r."orderId" = o.id
  AND (r.receipt_number IS NULL OR r.receipt_number = '');

COMMIT;
