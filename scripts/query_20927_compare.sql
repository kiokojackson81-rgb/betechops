-- Compare UI-style profit vs pricing-attribution for a single receipt

-- Summary row: ui_profit vs pricing-attribution profit (use CTE + subquery to avoid nested aggregates)
WITH rr AS (
  SELECT
    r.id,
    r."receiptNumber",
    r."sellingTotal",
    COALESCE(SUM(si."buyingPrice"),0) AS sum_items_buying_price_qty,
    COUNT(si.*) AS item_rows
  FROM "SupportReceipt" r
  JOIN "SupportReceiptItem" si ON si."receiptId" = r.id
  WHERE r."receiptNumber" = 'Betech-20251212-20927'
  GROUP BY r.id, r."receiptNumber", r."sellingTotal"
)
SELECT
  rr.id,
  rr."receiptNumber",
  rr."sellingTotal",
  rr.sum_items_buying_price_qty,
  (rr."sellingTotal" - rr.sum_items_buying_price_qty) AS ui_profit,
  rr.item_rows,
  COALESCE((
    SELECT SUM((rr."sellingTotal"::numeric / rr.item_rows) - si."buyingPrice"::numeric)
    FROM "SupportReceiptItem" si
    WHERE si."receiptId" = rr.id
  ),0) AS db_equal_split_profit
FROM rr;

SELECT si.id, si."productName", si."buyingPrice", si."pricedAt", si."createdAt", si."updatedAt"
FROM "SupportReceiptItem" si
JOIN "SupportReceipt" r ON r.id = si."receiptId"
WHERE r."receiptNumber" = 'Betech-20251212-20927'
ORDER BY si.id;
