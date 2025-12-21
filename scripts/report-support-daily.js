const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const arg = process.argv[2]; // ISO date string e.g. 2025-11-14
const since = arg ? new Date(arg) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
(async () => {
  try {
    console.log('Since:', since.toISOString());
    const rows = await prisma.supportDailyEntry.findMany({
      where: { date: { gte: since } },
      select: { id: true, date: true, submittedById: true, totalSales: true },
      orderBy: { date: 'desc' },
    });
    for (const r of rows) console.log(JSON.stringify(r));
    const agg = await prisma.supportDailyEntry.aggregate({ where: { date: { gte: since } }, _sum: { totalSales: true }, _count: { id: true } });
    console.log('SupportTotals:', JSON.stringify(agg));
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
