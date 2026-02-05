const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ws = new Date('2025-12-28');
    const we = new Date('2026-01-03');
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: {
        AND: [
          { weekStart: { lte: we } },
          { weekEnd: { gte: ws } },
        ],
      },
      include: { account: true },
      orderBy: { payoutAmount: 'desc' },
    });

    console.log('shop,statementNumber,gross,payout,isPaid');
    for (const r of rows) {
      const name = (r.account?.displayName ?? r.accountId).replace(/,/g, '');
      const gross = Number(r.grossSales ?? 0).toFixed(2);
      const payout = Number(r.payoutAmount ?? 0).toFixed(2);
      console.log(`${name},${r.statementNumber},${gross},${payout},${r.isPaid}`);
    }
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
