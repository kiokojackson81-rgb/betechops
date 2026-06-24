DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'WebsiteOrder'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Receipt'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'WebsiteOrder_receiptId_fkey'
      AND table_name = 'WebsiteOrder'
  ) THEN
    ALTER TABLE "WebsiteOrder"
      ADD CONSTRAINT "WebsiteOrder_receiptId_fkey"
      FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
