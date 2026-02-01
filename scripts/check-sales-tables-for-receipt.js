const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const needle = process.argv[2];
  if (!needle) { console.error('Usage: node check-sales-tables-for-receipt.js <needle>'); process.exit(2); }
  try {
    const m = await prisma.$queryRawUnsafe(`SELECT id, "receiptNumber", "receiptKey", "sellingTotal" FROM "MarketingReceipt" WHERE "receiptNumber" = '${needle}' OR "receiptKey" ILIKE '%${needle}%' LIMIT 20`);
    console.log('MarketingReceipt matches:', m.length);
    if (m.length) console.dir(m, { depth: 2 });

    const ms = await prisma.$queryRawUnsafe(`SELECT id, "receiptNumber", "sellingPrice", "buyingPrice", "paymentMethod" FROM "MarketingSale" WHERE "receiptNumber" = '${needle}' LIMIT 20`);
    console.log('MarketingSale matches:', ms.length);
    if (ms.length) console.dir(ms, { depth: 2 });

    const ds = await prisma.$queryRawUnsafe(`SELECT id, "receiptNumber", "price", "paymentMethod", "productName" FROM "DailySale" WHERE "receiptNumber" = '${needle}' LIMIT 20`);
    console.log('DailySale matches:', ds.length);
    if (ds.length) console.dir(ds, { depth: 2 });

    const ss = await prisma.$queryRawUnsafe(`SELECT id, "receiptNumber", "sellingPrice", "buyingPrice" FROM "SupportSale" WHERE "receiptNumber" = '${needle}' LIMIT 20`);
    console.log('SupportSale matches:', ss.length);
    if (ss.length) console.dir(ss, { depth: 2 });

    const w = await prisma.$queryRawUnsafe(`SELECT id, "status", "amount" FROM "WeeklySale" WHERE "status"='APPROVED' AND ("receiptNumber" = '${needle}') LIMIT 20`);
    console.log('WeeklySale matches:', w.length);
    if (w.length) console.dir(w, { depth: 2 });

  } catch (e) {
    console.error('Query failed:', e && e.message ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
})();
