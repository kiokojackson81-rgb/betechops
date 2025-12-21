const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.commissionLedger.findMany({ orderBy: [{ periodStart: 'desc' }, { userId: 'asc' }], take: 50 });
    console.log('commissionLedger rows (latest 50):');
    rows.forEach((r) => {
      console.log({ id: r.id, userId: r.userId, periodStart: r.periodStart, periodEnd: r.periodEnd, commissionTotal: r.commissionTotal, grossCommission: r.grossCommission, netCommission: r.netCommission });
    });
  } catch (e) {
    console.error('inspect failed:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
