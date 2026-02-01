const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const receiptNumber = process.argv[2];
  if (!receiptNumber) {
    console.error('Usage: node check-linked-marketing-sales.js <receipt_number_or_id>');
    process.exit(2);
  }
  console.log('Checking marketing/support/weekly/daily reports for:', receiptNumber);

  const m = await prisma.$queryRaw`
    SELECT id, "receiptNumber", "receiptKey", "sellingTotal", "buyingTotal"
    FROM "MarketingReceipt"
    WHERE "receiptNumber" = ${receiptNumber} OR "receiptKey" ILIKE ${`%${receiptNumber}%`}
  `;

  console.log('\nMarketingReceipt matches:', Array.isArray(m) ? m.length : 0);
  if (Array.isArray(m) && m.length) console.dir(m, { depth: 2 });

  const s = await prisma.$queryRaw`
    SELECT id, "receiptNumber", "receiptKey", "sellingTotal", "buyingTotal"
    FROM "SupportReceipt"
    WHERE "receiptNumber" = ${receiptNumber} OR "receiptKey" ILIKE ${`%${receiptNumber}%`}
  `;
  console.log('\nSupportReceipt matches:', Array.isArray(s) ? s.length : 0);
  if (Array.isArray(s) && s.length) console.dir(s, { depth: 2 });

  const weekly = await prisma.$queryRaw`
    SELECT id, "receiptNumber", amount, status
    FROM "WeeklySale"
    WHERE status = 'APPROVED' AND ("receiptNumber" = ${receiptNumber} OR "receiptNumber" ILIKE ${`%${receiptNumber}%`})
  `;
  console.log('\nWeeklySale matches:', Array.isArray(weekly) ? weekly.length : 0);
  if (Array.isArray(weekly) && weekly.length) console.dir(weekly, { depth: 2 });

  const daily = await prisma.$queryRaw`
    SELECT id, userId, date, sales
    FROM "DailyReport"
    WHERE sales::text ILIKE ${`%${receiptNumber}%`}
    LIMIT 10
  `;
  console.log('\nDailyReport matches:', Array.isArray(daily) ? daily.length : 0);
  if (Array.isArray(daily) && daily.length) console.dir(daily, { depth: 2 });

  await prisma.$disconnect();
}

main().catch(e=>{console.error('Script failed:', e && e.message ? e.message : e); process.exit(1)});
