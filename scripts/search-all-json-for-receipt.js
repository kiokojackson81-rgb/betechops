const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const needle = process.argv[2];
  if (!needle) { console.error('Usage: node search-all-json-for-receipt.js <needle>'); process.exit(2); }
  console.log('Searching JSON fields for:', needle);

  const checks = [
    { table: 'MarketingDailyEntry', col: 'receipts' },
    { table: 'MarketingReceipt', col: 'receiptNumber' },
    { table: 'SupportReceipt', col: 'receiptNumber' },
    { table: 'DailyReport', col: 'sales' },
    { table: 'WeeklySale', col: 'receiptNumber' },
    { table: 'Receipt', col: 'data' },
  ];

  for (const c of checks) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT id, ${c.col} FROM "${c.table}" WHERE ${c.col}::text ILIKE '%${needle}%' LIMIT 10`);
      console.log('\nTable:', c.table, 'matches:', rows.length);
      if (rows.length) console.dir(rows, { depth: 2 });
    } catch (e) {
      console.warn('Skipped', c.table, 'error:', e && e.message ? e.message : e);
    }
  }

  await prisma.$disconnect();
}

main().catch(e=>{console.error('Script failed:', e && e.message ? e.message : e); process.exit(1)});
