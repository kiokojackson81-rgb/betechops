const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ws = new Date('2025-12-28');
    const we = new Date('2026-01-03');
    console.log('Querying overlapping MarketplacePayoutWeek for', ws.toISOString().slice(0,10), '->', we.toISOString().slice(0,10));
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
    console.log('Found rows:', rows.length);
    let totalGross = 0;
    let totalPayout = 0;
    for (const r of rows) {
      const acct = r.account?.displayName ?? r.accountId;
      const gross = Number(r.grossSales ?? 0);
      const payout = Number(r.payoutAmount ?? 0);
      totalGross += gross;
      totalPayout += payout;
      console.log(`${acct.padEnd(20)} | statement=${r.statementNumber} | weekStart=${r.weekStart.toISOString().slice(0,10)} weekEnd=${r.weekEnd.toISOString().slice(0,10)} | gross=${gross.toFixed(2)} | payout=${payout.toFixed(2)} | isPaid=${r.isPaid}`);
    }
    console.log('--- totals ---');
    console.log('rows:', rows.length);
    console.log('totalGross:', totalGross.toFixed(2));
    console.log('totalPayout:', totalPayout.toFixed(2));

  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
