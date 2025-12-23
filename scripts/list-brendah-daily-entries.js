// scripts/list-brendah-daily-entries.js
// Usage: DATABASE_URL="..." node scripts/list-brendah-daily-entries.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.marketingDailyEntry.findMany({
      where: {
        OR: [
          { submittedById: 'cmimxqfnr0005v5mc05nwhg9o' },
          { submittedByEmail: 'brendah@betech.co.ke' }
        ],
      },
      orderBy: { date: 'desc' },
      select: { id: true, date: true, submittedById: true, submittedBy: true, submittedByEmail: true, totalSales: true, totalProfit: true },
    });
    console.log('FOUND', rows.length, 'entries');
    rows.forEach(r => console.log(r.id, r.date && r.date.toISOString().slice(0,10), 'submittedById=', r.submittedById || '', 'email=', r.submittedByEmail || '', 'sales=', r.totalSales, 'profit=', r.totalProfit));
  } catch (e) {
    console.error('ERR', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
