-- Idempotent seed to ensure SupportReceipt Betech-20251212-20927
-- aligns with expected buyingTotal and support items.
-- Run with the DATABASE_URL pointing at your Neon DB.

DO $$
DECLARE
  srid text;
BEGIN
  -- find support receipt (if exists)
  SELECT id INTO srid FROM "SupportReceipt" WHERE "receiptNumber" = 'Betech-20251212-20927';

  IF srid IS NULL THEN
    -- create a minimal support receipt; adjust dailyEntryId if your schema requires it
    INSERT INTO "SupportReceipt" ("receiptNumber", "sellingTotal", "buyingTotal", "paymentMethod", "createdAt", "updatedAt")
    VALUES ('Betech-20251212-20927', 11000, 6280, 'MPESA', now(), now())
    RETURNING id INTO srid;
  ELSE
    -- update totals to desired values
    UPDATE "SupportReceipt"
    SET "sellingTotal" = 11000,
        "buyingTotal" = 6280,
        "updatedAt" = now()
    WHERE id = srid;
  END IF;

  -- remove any existing items for a clean, idempotent state
  DELETE FROM "SupportReceiptItem" WHERE "receiptId" = srid;

  -- insert five support items with explicit pricedAt timestamps
    -- generate a stable-ish id for each inserted item to satisfy NOT NULL id columns
    INSERT INTO "SupportReceiptItem" (id, "receiptId", "productName", "buyingPrice", "pricedAt", "createdAt", "updatedAt")
    SELECT ('seed-' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 24))::text AS id,
      srid, v.productName, v.buyingPrice, v.pricedAt, now(), now()
  FROM (VALUES
    ('2x1 Tracking', 1256, '2025-12-12T14:44:30.743+03:00'::timestamptz),
    ('Battery Fuse', 1256, '2025-12-12T14:44:31.238+03:00'::timestamptz),
    ('AVS', 1256, '2025-12-12T14:44:31.698+03:00'::timestamptz),
    ('Battery Cable', 1256, '2025-12-12T14:44:32.154+03:00'::timestamptz),
    ('Cable Lugs', 1256, '2025-12-12T14:44:32.641+03:00'::timestamptz)
  ) AS v(productName, buyingPrice, pricedAt);

  -- ensure summary totals are correct
  UPDATE "SupportReceipt"
  SET "buyingTotal" = COALESCE((SELECT SUM("buyingPrice") FROM "SupportReceiptItem" WHERE "receiptId" = srid), 0),
      "sellingTotal" = 11000,
      "updatedAt" = now()
  WHERE id = srid;

END $$;

-- Optional: show resulting row
SELECT id, "receiptNumber", "sellingTotal", "buyingTotal", "createdAt", "updatedAt"
FROM "SupportReceipt" WHERE "receiptNumber" = 'Betech-20251212-20927';
