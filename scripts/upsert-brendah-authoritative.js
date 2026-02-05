const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
const STEP_POINTS = [2000000,3000000,4000000,5000000,6000000,7000000,8000000,9000000,10000000];
const STEP_REWARDS = [15000,20000,20000,20000,20000,20000,20000,20000,20000];

function computeBrendahDirectCommission(totalSales, totalProfit){
  if (!totalSales || totalSales <= 0) return { amount: 0, mode: 'none' };
  if (totalSales < 500000){
    const profit = Math.max(totalProfit||0,0);
    const amount = Math.round(profit * 0.05);
    return { amount, mode: amount>0 ? 'direct_fallback' : 'none' };
  }

  let commission = 0;
  if (totalSales <= 1000000){
    const progress = (totalSales - 500000) / 500000;
    commission = Math.round(clamp01(progress) * 10000);
  } else {
    commission = 10000;
    if (totalSales < 2000000){
      const frac = (totalSales - 1000000) / 1000000;
      const prorated = Math.round(clamp01(frac) * STEP_REWARDS[0]);
      commission += prorated;
    } else {
      commission += STEP_REWARDS[0];
      for (let i=1;i<STEP_POINTS.length;i++){
        const point = STEP_POINTS[i]; const reward = STEP_REWARDS[i];
        if (totalSales >= point) commission += reward; else break;
      }
    }
  }

  const profitWithinFirstBand = totalSales > 0 ? (Math.min(totalSales, 500000) / totalSales) * Math.max(totalProfit||0, 0) : 0;
  const profitPart = Math.round(profitWithinFirstBand * 0.05);
  const amount = commission + profitPart;
  return { amount, mode: 'direct_progressive', profitPart };
}

async function main(){
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error('user not found: ' + email);

    const periodStart = new Date('2026-01-25T00:00:00.000Z');
    const periodEnd = new Date('2026-02-24T23:59:59.999Z');

    // aggregate support receipts
    const supportAgg = await prisma.supportDailyEntry.aggregate({ where: { submittedById: user.id, date: { gte: periodStart, lte: periodEnd } }, _sum: { totalSales: true, totalProfit: true } });

    const totalSales = Number(supportAgg._sum.totalSales ?? 0);
    const totalProfit = Number(supportAgg._sum.totalProfit ?? 0);

    // daily reports for product commissions
    const reports = await prisma.dailyReport.findMany({ where: { userId: user.id, date: { gte: periodStart, lte: periodEnd } }, select: { newProducts: true, productsEdited: true, copiesUploaded: true } });
    let newProducts = 0, editedProducts = 0, copiedProducts = 0;
    for (const r of reports){ newProducts += r.newProducts ?? 0; editedProducts += r.productsEdited ?? 0; copiedProducts += r.copiesUploaded ?? 0; }

    const direct = computeBrendahDirectCommission(totalSales, totalProfit);

    const eligibleNew = Math.max(0, newProducts - 2000);
    const newProductCommission = Math.min(eligibleNew * 3, 10000);
    const copiedCommission = Math.floor(copiedProducts / 5);
    const editedCommission = Math.floor(editedProducts / 10);
    const productTotal = newProductCommission + copiedCommission + editedCommission;

    const grossCommission = Math.round(direct.amount + productTotal);

    const detail = {
      support: { totals: { totalSales: totalSales, totalProfit: totalProfit, totalReceipts: 0 }, periodKey: '2026-01-25_2026-02-24', commission: direct.amount, computedAt: new Date().toISOString() },
      marketing: { totals: { totalItems: 0 }, periodKey: '2026-01-25_2026-02-24', commission: 0, computedAt: new Date().toISOString() },
      supportCommission: direct.amount,
      products: { newProductCommission, copiedCommission, editedCommission, total: productTotal }
    };

    const upsert = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart, periodEnd } },
      create: {
        userId: user.id,
        periodStart,
        periodEnd,
        grossCommission: String(grossCommission),
        netCommission: String(grossCommission),
        commissionDirect: String(direct.amount),
        commissionMarketplaceJumia: '0',
        commissionMarketplaceKilimall: '0',
        commissionTotal: String(grossCommission),
        commissionBreakdown: { support: direct.amount, products: productTotal, marketing: 0 },
        detail,
      },
      update: {
        grossCommission: String(grossCommission),
        netCommission: String(grossCommission),
        commissionDirect: String(direct.amount),
        commissionMarketplaceJumia: '0',
        commissionMarketplaceKilimall: '0',
        commissionTotal: String(grossCommission),
        commissionBreakdown: { support: direct.amount, products: productTotal, marketing: 0 },
        detail,
      }
    });

    console.log('Upserted ledger:', upsert.id);
    console.log(JSON.stringify({ id: upsert.id, commissionTotal: upsert.commissionTotal, grossCommission: upsert.grossCommission, detail: upsert.detail }, null, 2));
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try{ await prisma.$disconnect(); } catch(_){}
  }
}

main();
