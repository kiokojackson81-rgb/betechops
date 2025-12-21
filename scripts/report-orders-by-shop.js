const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const arg = process.argv[2]; // ISO date string e.g. 2025-11-14
const since = arg ? new Date(arg) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
(async () => {
  try {
    console.log('Since:', since.toISOString());
    const rows = await prisma.order.groupBy({
      by: ['shopId', 'status'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { paidAmount: true },
      orderBy: { _count: { id: 'desc' } },
    });
    for (const r of rows) console.log(JSON.stringify(r));
    const total = await prisma.order.aggregate({ where: { createdAt: { gte: since } }, _count: { id: true }, _sum: { paidAmount: true } });
    console.log('TotalAllShops:', JSON.stringify(total));
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
