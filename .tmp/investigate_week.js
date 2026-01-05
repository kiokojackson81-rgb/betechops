const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ws = '2025-12-28';
    const we = '2026-01-03';
    console.log('Querying MarketplacePayoutWeek for', ws, '->', we);
    const rows = await prisma.marketplacePayoutWeek.findMany({
      where: { weekStart: new Date(ws), weekEnd: new Date(we) },
      orderBy: { payoutAmount: 'desc' },
      include: { account: true },
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
      console.log(`${acct.padEnd(20)} | statement=${r.statementNumber} | gross=${gross.toFixed(2)} | payout=${payout.toFixed(2)} | isPaid=${r.isPaid}`);
    }
    console.log('--- totals ---');
    console.log('rows:', rows.length);
    console.log('totalGross:', totalGross.toFixed(2));
    console.log('totalPayout:', totalPayout.toFixed(2));

    // Show WeeklySale rows for same period (to compare)
    const sales = await prisma.weeklySale.findMany({ where: { weekStart: new Date(ws), weekEnd: new Date(we) }, include: { shop: true } });
    console.log('WeeklySale rows found:', sales.length);
    for (const s of sales) {
      console.log(`shop=${s.shop?.name ?? s.shopId} | amount=${Number(s.amount).toFixed(2)} | status=${s.status} | source=${s.source}`);
    }
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
