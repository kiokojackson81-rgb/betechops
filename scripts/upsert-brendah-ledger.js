const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const email = 'brendah@betech.co.ke';
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return console.error('User not found:', email);

    const periodStart = new Date('2026-01-25T00:00:00.000Z');
    const periodEnd = new Date('2026-02-24T23:59:59.999Z');

    const detail = {
      support: {
        totals: { totalSales: 1550573, totalProfit: 413333, totalReceipts: 79 },
        periodKey: '2026-01-25_2026-02-24',
        commission: 15305,
        computedAt: new Date().toISOString(),
      },
      marketing: {
        totals: { totalItems: 102 },
        periodKey: '2026-01-25_2026-02-24',
        commission: 0,
        computedAt: new Date().toISOString(),
      },
      supportCommission: 15305,
    };

    const upsert = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart, periodEnd } },
      create: {
        userId: user.id,
        periodStart,
        periodEnd,
        grossCommission: '23823',
        netCommission: '23823',
        commissionDirect: '15305',
        commissionMarketplaceJumia: '0',
        commissionMarketplaceKilimall: '0',
        commissionTotal: '15305',
        commissionBreakdown: { support: 15305, products: 0, marketing: 0 },
        detail,
      },
      update: {
        grossCommission: '23823',
        netCommission: '23823',
        commissionDirect: '15305',
        commissionMarketplaceJumia: '0',
        commissionMarketplaceKilimall: '0',
        commissionTotal: '15305',
        commissionBreakdown: { support: 15305, products: 0, marketing: 0 },
        detail,
      },
    });

    console.log('Upserted ledger:', upsert.id);
    console.log(JSON.stringify({ id: upsert.id, periodStart: upsert.periodStart, periodEnd: upsert.periodEnd, commissionTotal: upsert.commissionTotal, grossCommission: upsert.grossCommission, detail: upsert.detail }, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
