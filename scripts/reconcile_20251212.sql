-- Full-day reconciliation for Nairobi date 2025-12-12
-- Compares UI-style per-receipt profit (sellingTotal - sum(buyingPrice * qty))
-- versus pricing-attribution profit (split sellingTotal across item rows)

WITH receipt_agg AS (
  SELECT
    r.id,
    r."receiptNumber",
    r."sellingTotal",
    COALESCE(SUM(si."buyingPrice"), 0) AS ui_buying_sum,
    COUNT(si.*) AS item_rows
  FROM "SupportReceipt" r
  JOIN "SupportReceiptItem" si ON si."receiptId" = r.id
  WHERE (r."createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
  GROUP BY r.id, r."receiptNumber", r."sellingTotal"
)
SELECT
  ra."receiptNumber",
  ra."sellingTotal",
  ra.ui_buying_sum,
  (ra."sellingTotal" - ra.ui_buying_sum) AS ui_profit,
  ra.item_rows,
  -- pricing-attribution profit: for each item in the receipt, (sellingTotal / item_rows) - buyingPrice
  COALESCE((
    SELECT SUM((ra."sellingTotal"::numeric / ra.item_rows) - si."buyingPrice"::numeric)
    FROM "SupportReceiptItem" si
    WHERE si."receiptId" = ra.id AND si."buyingPrice" IS NOT NULL
  ),0) AS pricing_profit
FROM receipt_agg ra
ORDER BY ra."receiptNumber";
