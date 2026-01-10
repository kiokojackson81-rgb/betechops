try { require('dotenv').config(); } catch {}
const { prisma } = require('../.worker-dist/src/lib/prisma');

(async () => {
  try {
    const raw = process.argv[2] || '2026-01-04T21:00:00.000Z';
    const weekStart = new Date(raw);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: {
        AND: [
          { weekStart: { gte: weekStart } },
          { weekStart: { lt: weekEnd } },
          { account: { platform: 'JUMIA' } },
        ],
      },
      include: { account: true },
      orderBy: { accountId: 'asc' },
    });

    const totalGross = rows.reduce((s, r) => s + Number(r.grossSales ?? 0), 0);
    const totalPayout = rows.reduce((s, r) => s + Number(r.payoutAmount ?? 0), 0);

    console.log('Week:', weekStart.toISOString(), '->', weekEnd.toISOString());
    console.log('Rows:', rows.length);
    console.log('Total gross:', totalGross.toFixed(2));
    console.log('Total payout:', totalPayout.toFixed(2));
    console.log('Per-account:');
    for (const r of rows) {
      console.log('-', r.account?.displayName ?? r.accountId, 'gross:', String(r.grossSales), 'payout:', String(r.payoutAmount), 'stmt:', r.statementNumber);
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
