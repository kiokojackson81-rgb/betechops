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
  return { amount, commission, profitPart, mode: 'direct_progressive' };
}

(async ()=>{
  try {
    const email = process.argv[2] || 'brendah@betech.co.ke';
    const start = new Date(process.argv[3] || '2026-01-25T00:00:00.000Z');
    const end = new Date(process.argv[4] || '2026-02-24T23:59:59.999Z');

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user) throw new Error('user not found');

    // aggregate support and marketing (dedup not required for this check)
    const supportAgg = await prisma.supportDailyEntry.aggregate({ where: { submittedById: user.id, date: { gte: start, lte: end } }, _sum: { totalSales: true, totalProfit: true }, _count: { id: true } });
    const marketingAgg = await prisma.marketingDailyEntry.aggregate({ where: { submittedById: user.id, date: { gte: start, lte: end } }, _sum: { totalSales: true, totalProfit: true }, _count: { id: true } });

    const totalSales = Number((supportAgg._sum.totalSales ?? 0) + (marketingAgg._sum.totalSales ?? 0));
    const totalProfit = Number((supportAgg._sum.totalProfit ?? 0) + (marketingAgg._sum.totalProfit ?? 0));

    // product commissions
    const reports = await prisma.dailyReport.findMany({ where: { userId: user.id, date: { gte: start, lte: end } }, select: { newProducts: true, productsEdited: true, copiesUploaded: true } });
    let newProducts = 0, editedProducts = 0, copiedProducts = 0;
    for (const r of reports){ newProducts += r.newProducts ?? 0; editedProducts += r.productsEdited ?? 0; copiedProducts += r.copiesUploaded ?? 0; }
    const eligibleNew = Math.max(0, newProducts - 2000);
    const newProductCommission = Math.min(eligibleNew * 3, 10000);
    const copiedCommission = Math.floor(copiedProducts / 5);
    const editedCommission = Math.floor(editedProducts / 10);
    const productTotal = newProductCommission + copiedCommission + editedCommission;

    // compute direct commission per Brendah rule
    const direct = computeBrendahDirectCommission(totalSales, totalProfit);
    const computedGrossCommission = Math.round(direct.amount + productTotal);

    // find persisted ledger if any
    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: start, periodEnd: end } } });

    const response = {
      user: { id: user.id, email: user.email, name: user.name },
      period: { start: start.toISOString(), end: end.toISOString() },
      totals: { totalSales, totalProfit, receipts: Number(supportAgg._count.id ?? 0) + Number(marketingAgg._count.id ?? 0) },
      computed: {
        salesCommission: direct.amount,
        newProductCommission,
        copiedCommission,
        editedCommission,
        productTotal,
        grossCommission: computedGrossCommission,
      },
      ledger: ledger ? { id: ledger.id, commissionTotal: ledger.commissionTotal, grossCommission: ledger.grossCommission, detail: ledger.detail } : null,
    };

    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try{ await prisma.$disconnect(); } catch(_){}
  }
})();
