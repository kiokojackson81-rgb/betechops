-- Migration: add receipt_number to Receipt (safe, idempotent)
BEGIN;

ALTER TABLE IF EXISTS public."Receipt" ADD COLUMN IF NOT EXISTS receipt_number text;

-- create unique index only when the table exists and the index is missing
DO $$
BEGIN
  IF to_regclass('public."Receipt"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i'
        AND c.relname = 'uniq_receipt_number'
        AND n.nspname = 'public'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uniq_receipt_number ON public."Receipt"(receipt_number)';
    END IF;
  END IF;
END$$;

-- Backfill from Order.orderNumber where possible, but only if both tables exist
DO $$
BEGIN
  IF to_regclass('public."Receipt"') IS NOT NULL
     AND to_regclass('public."Order"') IS NOT NULL THEN
    EXECUTE '
      UPDATE public."Receipt" r
      SET receipt_number = o."orderNumber"
      FROM public."Order" o
      WHERE r."orderId" = o.id
        AND (r.receipt_number IS NULL OR r.receipt_number = '''')';
  END IF;
END$$;

COMMIT;
