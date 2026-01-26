const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error('user not found: ' + email);

    const periodStart = new Date('2026-01-25T00:00:00.000Z');
    const periodEnd = new Date('2026-02-24T23:59:59.999Z');

    const commissionTotal = 24926;
    const commissionDirect = 24922; // direct/progressive + profit part
    const productTotal = 4;

    const detail = {
      support: { totals: { totalSales: 1550573, totalProfit: 413333, totalReceipts: 79 }, periodKey: '2026-01-25_2026-02-24', commission: commissionDirect, computedAt: new Date().toISOString() },
      marketing: { totals: { totalItems: 102 }, periodKey: '2026-01-25_2026-02-24', commission: 0, computedAt: new Date().toISOString() },
      supportCommission: commissionDirect,
      products: { newProductCommission: 0, copiedCommission: 4, editedCommission: 0, total: productTotal }
    };

    const upsert = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart, periodEnd } },
      create: {
        userId: user.id,
        periodStart,
        periodEnd,
        grossCommission: String(commissionTotal),
        netCommission: String(commissionTotal),
        commissionDirect: String(commissionDirect),
        commissionMarketplaceJumia: '0',
        commissionMarketplaceKilimall: '0',
        commissionTotal: String(commissionTotal),
        commissionBreakdown: { support: commissionDirect, products: productTotal, marketing: 0 },
        detail,
      },
      update: {
        grossCommission: String(commissionTotal),
        netCommission: String(commissionTotal),
        commissionDirect: String(commissionDirect),
        commissionMarketplaceJumia: '0',
        commissionMarketplaceKilimall: '0',
        commissionTotal: String(commissionTotal),
        commissionBreakdown: { support: commissionDirect, products: productTotal, marketing: 0 },
        detail,
      }
    });

    console.log('Applied authoritative commission. Upserted ledger:', upsert.id);
    console.log(JSON.stringify({ id: upsert.id, commissionTotal: upsert.commissionTotal, grossCommission: upsert.grossCommission, detail: upsert.detail }, null, 2));
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try{ await prisma.$disconnect(); } catch(_){ }
  }
})();
