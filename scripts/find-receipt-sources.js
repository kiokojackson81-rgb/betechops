const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const receiptNumber = process.argv[2] || 'Betech-20251230-40824';
  console.log('Searching marketing/support records for:', receiptNumber);

  const m = await prisma.$queryRaw`
    SELECT id, "receiptNumber", "receiptKey", "sellingTotal", "buyingTotal"
    FROM "MarketingReceipt"
    WHERE "receiptNumber" = ${receiptNumber} OR "receiptKey" LIKE ${`%${receiptNumber}%`}
  `;

  const s = await prisma.$queryRaw`
    SELECT id, "receiptNumber", "receiptKey", "sellingTotal", "buyingTotal"
    FROM "SupportReceipt"
    WHERE "receiptNumber" = ${receiptNumber} OR "receiptKey" LIKE ${`%${receiptNumber}%`}
  `;

  console.log('\nMarketing receipts found:', Array.isArray(m) ? m.length : 0);
  if (Array.isArray(m) && m.length) {
    for (const row of m) {
      console.log('- MarketingReceipt id:', row.id, 'receiptNumber:', row.receiptNumber, 'sellingTotal:', row.sellingTotal, 'buyingTotal:', row.buyingTotal);
      const items = await prisma.$queryRaw`
        SELECT id, "productName", "buyingPrice" FROM "MarketingReceiptItem" WHERE "receiptId" = ${row.id}
      `;
      if (Array.isArray(items) && items.length) console.dir(items, { depth: 2 });
    }
  }

  console.log('\nSupport receipts found:', Array.isArray(s) ? s.length : 0);
  if (Array.isArray(s) && s.length) {
    for (const row of s) {
      console.log('- SupportReceipt id:', row.id, 'receiptNumber:', row.receiptNumber, 'sellingTotal:', row.sellingTotal, 'buyingTotal:', row.buyingTotal);
      const items = await prisma.$queryRaw`
        SELECT id, "productName", "buyingPrice" FROM "SupportReceiptItem" WHERE "receiptId" = ${row.id}
      `;
      if (Array.isArray(items) && items.length) console.dir(items, { depth: 2 });
    }
  }

  // Check profit snapshots for order related to the receipt
  const orderRow = await prisma.$queryRaw`
    SELECT o.id, o."orderNumber"
    FROM "Order" o
    WHERE o."orderNumber" = ${receiptNumber} OR o.id IN (SELECT "orderId" FROM "Receipt" WHERE "receipt_number" = ${receiptNumber})
    LIMIT 1
  `;
  if (Array.isArray(orderRow) && orderRow.length) {
    const oid = orderRow[0].id;
    console.log('\nOrder found:', orderRow[0]);
    const items = await prisma.$queryRaw`
      SELECT id, "productId", quantity, "sellingPrice"
      FROM "OrderItem"
      WHERE "orderId" = ${oid}
    `;
    console.log('Order items:', Array.isArray(items) ? items.length : 0);
    if (Array.isArray(items) && items.length) console.dir(items, { depth: 2 });

    const itemIds = Array.isArray(items) ? items.map((it) => it.id) : [];
    if (itemIds.length) {
      const snaps = await prisma.$queryRaw`
        SELECT id, "unitCost", revenue, profit, "orderItemId"
        FROM "ProfitSnapshot"
        WHERE "orderItemId" = ANY(${itemIds})
      `;
      console.log('Profit snapshots:', Array.isArray(snaps) ? snaps.length : 0);
      if (Array.isArray(snaps) && snaps.length) console.dir(snaps, { depth: 3 });
    }
    // Check OrderCost overrides
    if (itemIds.length) {
      const costs = await prisma.$queryRaw`
        SELECT id, "orderItemId", "unitCost", "costSource", "createdAt" FROM "OrderCost" WHERE "orderItemId" = ANY(${itemIds}) ORDER BY "createdAt" DESC
      `;
      console.log('OrderCost overrides found:', Array.isArray(costs) ? costs.length : 0);
      if (Array.isArray(costs) && costs.length) console.dir(costs, { depth: 2 });
    }
    // Try to derive buying prices from Product.lastBuyingPrice or ProductCost
    if (Array.isArray(items) && items.length) {
      console.log('\nDeriving buying prices from product data:');
      for (const it of items) {
        const prod = await prisma.$queryRaw`
          SELECT id, "name", "lastBuyingPrice" FROM "Product" WHERE id = ${it.productId} LIMIT 1
        `;
        const pc = await prisma.$queryRaw`
          SELECT id, price, "createdAt" FROM "ProductCost" WHERE "productId" = ${it.productId} ORDER BY "createdAt" DESC LIMIT 1
        `;
        const lastBuying = Array.isArray(prod) && prod.length ? Number(prod[0].lastBuyingPrice ?? 0) : 0;
        const costFromHistory = Array.isArray(pc) && pc.length ? Number(pc[0].price ?? 0) : 0;
        console.log(`- item ${it.id} qty=${it.quantity} selling=${it.sellingPrice} lastBuying=${lastBuying} historyCost=${costFromHistory}`);
      }
    }
  } else {
    console.log('\nNo direct order match found for receipt number.');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(async () => { await prisma.$disconnect(); });
