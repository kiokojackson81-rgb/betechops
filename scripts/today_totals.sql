-- Compute today's totals in Nairobi local date (2025-12-12)
-- Adjust the date below if you want a different day
-- Using literal date '2025-12-12'

-- SupportReceipt: count, total sales
SELECT 'support_receipts' as src, count(*) as receipts_count, coalesce(sum("sellingTotal"),0)::bigint as total_sales
FROM "SupportReceipt"
WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12';

-- SupportReceipt: profit computed per receipt as sellingTotal - sum(items.buyingPrice)
SELECT 'support_profit' as src, coalesce(sum(sr."sellingTotal" - si.buying_sum),0)::bigint as total_profit
FROM "SupportReceipt" sr
LEFT JOIN (
  SELECT "receiptId", sum("buyingPrice") as buying_sum, count(*) as item_count
  FROM "SupportReceiptItem"
  GROUP BY "receiptId"
) si ON si."receiptId" = sr.id
WHERE (sr."createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
  AND si.item_count > 0;

-- MarketingReceipt: count, total sales
SELECT 'marketing_receipts' as src, count(*) as receipts_count, coalesce(sum("sellingTotal"),0)::bigint as total_sales
FROM "MarketingReceipt"
WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12';

-- MarketingReceipt: profit computed per receipt as sellingTotal - sum(items.buyingPrice)
SELECT 'marketing_profit' as src, coalesce(sum(mr."sellingTotal" - mi.buying_sum),0)::bigint as total_profit
FROM "MarketingReceipt" mr
LEFT JOIN (
  SELECT "receiptId", sum("buyingPrice") as buying_sum, count(*) as item_count
  FROM "MarketingReceiptItem"
  GROUP BY "receiptId"
) mi ON mi."receiptId" = mr.id
WHERE (mr."createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
  AND mi.item_count > 0;

-- Generic Receipt: inspect sample totals JSON structure and sum if possible
SELECT 'receipt_samples' as src, jsonb_pretty(totals::jsonb) as sample_totals
FROM "Receipt"
WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
LIMIT 5;

-- Attempt to sum Receipt.totals->>'sellingTotal' if present
SELECT 'receipt_json_sales' as src, coalesce(sum((totals->>'sellingTotal')::numeric),0)::bigint as total_sales
FROM "Receipt"
WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
  AND totals->>'sellingTotal' IS NOT NULL;

-- Marketplace orders placed today (MarketplaceOrder.sellingPrice)
SELECT 'marketplace_orders' as src, count(*) as orders_count, coalesce(sum("sellingPrice"::numeric),0)::bigint as total_sales
FROM "MarketplaceOrder"
WHERE ("orderedAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12';

-- Marketplace profit where pricedAt today
SELECT 'marketplace_priced_profit' as src, coalesce(sum("profit"::numeric),0)::bigint as total_profit
FROM "MarketplaceOrder"
WHERE ("pricedAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
  AND "profit" IS NOT NULL;
