-- Investigate profit discrepancy for Nairobi date 2025-12-12
-- 1) SupportReceiptItems counted by pricing-based rule (pricedAt OR updatedAt within date)
--    profit per item = (receipt.sellingTotal / items_count) - buyingPrice
-- 2) MarketingSale profit where pricedAt/createdAt within date: (sellingPrice - buyingPrice)
-- 3) List SupportReceipt rows with negative sellingTotal

-- SupportReceiptItems counted for pricing-based profit on 2025-12-12
WITH receipt_item_counts AS (
  SELECT "receiptId", count(*) AS items_count
  FROM "SupportReceiptItem"
  GROUP BY "receiptId"
), support_items AS (
  SELECT s.id AS item_id,
         s."receiptId",
         r."receiptNumber",
         r."sellingTotal",
         ric.items_count,
         s."buyingPrice",
         COALESCE(s."pricedAt", s."updatedAt")::timestamptz AS priced_effective
  FROM "SupportReceiptItem" s
  JOIN "SupportReceipt" r ON r.id = s."receiptId"
  LEFT JOIN receipt_item_counts ric ON ric."receiptId" = r.id
  WHERE (COALESCE(s."pricedAt", s."updatedAt") AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
    AND s."buyingPrice" IS NOT NULL
)
SELECT 'support_priced_items' AS src,
       count(*) AS items_count,
       coalesce(sum((support_items."sellingTotal"::numeric / support_items.items_count) - support_items."buyingPrice"::numeric),0) AS total_profit,
       -- show any items contributing large values
       jsonb_agg(jsonb_build_object('item_id', support_items.item_id, 'receiptNumber', support_items."receiptNumber", 'sellingTotal', support_items."sellingTotal", 'items_count', support_items.items_count, 'buyingPrice', support_items."buyingPrice", 'profit', ((support_items."sellingTotal"::numeric / support_items.items_count) - support_items."buyingPrice"::numeric)::numeric)) FILTER (WHERE abs(((support_items."sellingTotal"::numeric / support_items.items_count) - support_items."buyingPrice"::numeric)) > 10000) AS notable_items
FROM support_items;

-- MarketingSale priced in window (pricedAt OR createdAt within date)
SELECT 'marketing_priced' AS src,
       count(*) AS rows_count,
       coalesce(sum(("sellingPrice"::numeric - "buyingPrice"::numeric)),0) AS total_profit,
       jsonb_agg(jsonb_build_object('id', id, 'sellingPrice', "sellingPrice", 'buyingPrice', "buyingPrice", 'priced_effective', COALESCE("pricedAt", "createdAt"))) FILTER (WHERE ("sellingPrice"::numeric - "buyingPrice"::numeric) > 10000) AS notable_marketing
FROM "MarketingSale"
WHERE (COALESCE("pricedAt", "createdAt") AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12';

-- List SupportReceipt rows with negative sellingTotal on that date
SELECT 'negative_support_receipts' AS src, id, "receiptNumber", "sellingTotal", "createdAt", "updatedAt", "buyingTotal"
FROM "SupportReceipt"
WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
  AND "sellingTotal" < 0
ORDER BY "sellingTotal" ASC;

-- Show items for those negative receipts
SELECT si.id, si."receiptId", si."productName", si."buyingPrice", si."pricedAt", si."updatedAt"
FROM "SupportReceiptItem" si
WHERE si."receiptId" IN (
  SELECT id FROM "SupportReceipt" WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12' AND "sellingTotal" < 0
)
ORDER BY si."receiptId";

-- Overall sums (support + marketing priced profits) by pricing-based attribution
WITH support_profit AS (
  SELECT coalesce(sum((r."sellingTotal"::numeric / ric.items_count) - s."buyingPrice"::numeric),0) AS support_total
  FROM "SupportReceiptItem" s
  JOIN "SupportReceipt" r ON r.id = s."receiptId"
  JOIN (SELECT "receiptId", count(*) AS items_count FROM "SupportReceiptItem" GROUP BY "receiptId") ric ON ric."receiptId" = r.id
  WHERE (COALESCE(s."pricedAt", s."updatedAt") AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
    AND s."buyingPrice" IS NOT NULL
), marketing_profit AS (
  SELECT coalesce(sum(("sellingPrice"::numeric - "buyingPrice"::numeric)),0) AS marketing_total
  FROM "MarketingSale"
  WHERE (COALESCE("pricedAt", "createdAt") AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
)
SELECT 'combined_pricing_attribution' AS src, (support_profit.support_total + marketing_profit.marketing_total)::numeric AS total_pricing_profit
FROM support_profit, marketing_profit;
