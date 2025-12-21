const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const date = '2025-12-12';

    // Support priced items
    const supportPricedItems = await prisma.$queryRawUnsafe(`
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
        WHERE (COALESCE(s."pricedAt", s."updatedAt") AT TIME ZONE 'Africa/Nairobi')::date = date '${date}'
          AND s."buyingPrice" IS NOT NULL
      )
      SELECT count(*) AS items_count,
             coalesce(sum((support_items."sellingTotal"::numeric / support_items.items_count) - support_items."buyingPrice"::numeric),0) AS total_profit
      FROM support_items;
    `);

    // Marketing priced
    const marketingPriced = await prisma.$queryRawUnsafe(`
      SELECT count(*) AS rows_count,
             coalesce(sum(("sellingPrice"::numeric - "buyingPrice"::numeric)),0) AS total_profit
      FROM "MarketingSale"
      WHERE (COALESCE("pricedAt", "createdAt") AT TIME ZONE 'Africa/Nairobi')::date = date '${date}';
    `);

    // Negative support receipts
    const negativeSupportReceipts = await prisma.$queryRawUnsafe(`
      SELECT id, "receiptNumber", "sellingTotal", "createdAt", "updatedAt", "buyingTotal"
      FROM "SupportReceipt"
      WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '${date}'
        AND "sellingTotal" < 0
      ORDER BY "sellingTotal" ASC;
    `);

    // Items for negative receipts
    const negativeItems = await prisma.$queryRawUnsafe(`
      SELECT si.id, si."receiptId", si."productName", si."buyingPrice", si."pricedAt", si."updatedAt"
      FROM "SupportReceiptItem" si
      WHERE si."receiptId" IN (
        SELECT id FROM "SupportReceipt" WHERE ("createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '${date}' AND "sellingTotal" < 0
      )
      ORDER BY si."receiptId";
    `);

    // Combined pricing attribution
    const combined = await prisma.$queryRawUnsafe(`
      WITH support_profit AS (
        SELECT coalesce(sum((r."sellingTotal"::numeric / ric.items_count) - s."buyingPrice"::numeric),0) AS support_total
        FROM "SupportReceiptItem" s
        JOIN "SupportReceipt" r ON r.id = s."receiptId"
        JOIN (SELECT "receiptId", count(*) AS items_count FROM "SupportReceiptItem" GROUP BY "receiptId") ric ON ric."receiptId" = r.id
        WHERE (COALESCE(s."pricedAt", s."updatedAt") AT TIME ZONE 'Africa/Nairobi')::date = date '${date}'
          AND s."buyingPrice" IS NOT NULL
      ), marketing_profit AS (
        SELECT coalesce(sum(("sellingPrice"::numeric - "buyingPrice"::numeric)),0) AS marketing_total
        FROM "MarketingSale"
        WHERE (COALESCE("pricedAt", "createdAt") AT TIME ZONE 'Africa/Nairobi')::date = date '${date}'
      )
      SELECT (support_profit.support_total + marketing_profit.marketing_total)::numeric AS total_pricing_profit
      FROM support_profit, marketing_profit;
    `);

      // Detailed support items list (per-item profit) ordered by profit desc
      const supportItemsDetails = await prisma.$queryRawUnsafe(`
        WITH receipt_item_counts AS (
          SELECT "receiptId", count(*) AS items_count
          FROM "SupportReceiptItem"
          GROUP BY "receiptId"
        )
        SELECT s.id as item_id,
               s."receiptId",
               r."receiptNumber",
               r."sellingTotal",
               ric.items_count,
               s."buyingPrice",
               (r."sellingTotal"::numeric / ric.items_count) - s."buyingPrice"::numeric AS profit,
               COALESCE(s."pricedAt", s."updatedAt") AT TIME ZONE 'Africa/Nairobi' AS priced_effective
        FROM "SupportReceiptItem" s
        JOIN "SupportReceipt" r ON r.id = s."receiptId"
        JOIN receipt_item_counts ric ON ric."receiptId" = r.id
        WHERE (COALESCE(s."pricedAt", s."updatedAt") AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
          AND s."buyingPrice" IS NOT NULL
        ORDER BY profit DESC;
      `);

        // Receipt-based profit for receipts created on the date (sum per receipt of sellingTotal - sum(buyingPrice))
        const receiptBased = await prisma.$queryRawUnsafe(`
          SELECT r.id, r."receiptNumber", r."sellingTotal", sum(si."buyingPrice") as buying_sum, (r."sellingTotal"::numeric - sum(si."buyingPrice")::numeric) as profit
          FROM "SupportReceipt" r
          JOIN "SupportReceiptItem" si ON si."receiptId" = r.id
          WHERE (r."createdAt" AT TIME ZONE 'Africa/Nairobi')::date = date '2025-12-12'
          GROUP BY r.id
          ORDER BY profit DESC;
        `);

    function normalize(obj) {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(normalize);
      if (typeof obj === 'bigint') return obj.toString();
      if (typeof obj === 'object') {
        const out = {};
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          if (typeof v === 'bigint') out[k] = v.toString();
          else if (v instanceof Date) out[k] = v.toISOString();
          else if (Array.isArray(v)) out[k] = normalize(v);
          else if (v && typeof v === 'object') out[k] = normalize(v);
          else out[k] = v;
        }
        return out;
      }
      return obj;
    }

    console.log(JSON.stringify({
      supportPricedItems: normalize(supportPricedItems),
      marketingPriced: normalize(marketingPriced),
      negativeSupportReceipts: normalize(negativeSupportReceipts),
      negativeItems: normalize(negativeItems),
      supportItemsDetails: normalize(supportItemsDetails),
      receiptBased: normalize(receiptBased),
      combined: normalize(combined),
    }, null, 2));
  } catch (err) {
    console.error('Error running investigation', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) run();
