const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.marketplacePayoutWeek.findMany({
      orderBy: { weekStart: 'desc' },
      take: 100,
      select: { statementNumber: true, payoutAmount: true, isPaid: true, weekStart: true, weekEnd: true, account: { select: { displayName: true } } }
    });
    console.log('Recent payout weeks count:', rows.length);
    for (const r of rows) {
      console.log(`${r.weekStart.toISOString().split('T')[0]} - ${r.weekEnd.toISOString().split('T')[0]} | ${r.statementNumber} | ${Number(r.payoutAmount).toFixed(2)} | ${r.isPaid} | ${r.account?.displayName}`);
    }
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
