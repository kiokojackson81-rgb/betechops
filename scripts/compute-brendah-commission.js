const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Inline commission helpers (mirrors src/lib/onlineCommission.ts)
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
const STEP_POINTS = [2000000,3000000,4000000,5000000,6000000,7000000,8000000,9000000,10000000];
const STEP_REWARDS = [15000,20000,20000,20000,20000,20000,20000,20000,20000];
function progressiveAmount(totalSales){
  if (totalSales <= 1000000){
    const progress = (totalSales - 500000) / 500000;
    return Math.round(clamp01(progress) * 10000);
  }
  let commission = 10000;
  for (let i=0;i<STEP_POINTS.length;i++){ const point=STEP_POINTS[i], reward=STEP_REWARDS[i]; if (totalSales>=point) commission += reward; else break; }
  return Math.round(commission);
}
function computeDirectCommission(totalSales, totalProfit){
  if (!totalSales || totalSales <= 0) return { amount: 0, mode: 'none' };
  if (totalSales < 500000){
    const profit = Math.max(totalProfit||0,0);
    const amount = Math.round(profit * 0.05);
    return { amount, mode: amount>0 ? 'direct_fallback' : 'none' };
  }
  const progressive = progressiveAmount(totalSales);
  const profitWithinFirstBand = totalSales > 0 ? (Math.min(totalSales, 500000) / totalSales) * Math.max(totalProfit||0, 0) : 0;
  const profitPart = Math.round(profitWithinFirstBand * 0.05);
  return { amount: progressive + profitPart, mode: 'direct_progressive' };
}
function computeMarketplaceCommission(totalSales){
  if (totalSales < 500000) return { amount: 0, mode: 'none' };
  return { amount: progressiveAmount(totalSales), mode: 'marketplace_progressive' };

}

function computeOnlinePeriodCommission(inputs){
  const direct = computeDirectCommission(inputs.directSales, inputs.directProfit);
  const jumia = computeMarketplaceCommission(inputs.jumiaSales);
  const kilimall = computeMarketplaceCommission(inputs.kilimallSales);
  const lines = [
    { channel: 'DIRECT', sales: inputs.directSales, profit: inputs.directProfit, commission: direct.amount, mode: direct.mode },
    { channel: 'JUMIA', sales: inputs.jumiaSales, commission: jumia.amount, mode: jumia.mode },
    { channel: 'KILIMALL', sales: inputs.kilimallSales, commission: kilimall.amount, mode: kilimall.mode },
  ];
  const totalCommission = Math.round(lines.reduce((acc, l) => acc + (l.commission || 0), 0));
  return { lines, totalCommission };
}

async function main(email) {

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('user not found: ' + email);

  const now = new Date();
  const period = await prisma.commissionPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
  if (!period) throw new Error('no active commission period found');

  const supportAgg = await prisma.supportDailyEntry.aggregate({
    where: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } },
    _sum: { totalSales: true, totalProfit: true },
  });

  const marketingAgg = await prisma.marketingDailyEntry.aggregate({
    where: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } },
    _sum: { totalSales: true, totalProfit: true },
  });

  const directSales = Number(supportAgg._sum.totalSales ?? 0);
  const directProfit = Number(supportAgg._sum.totalProfit ?? 0);
  const jumiaSales = Number(marketingAgg._sum.totalSales ?? 0);
  const jumiaProfit = Number(marketingAgg._sum.totalProfit ?? 0);

  const computed = computeOnlinePeriodCommission({ attendantId: user.id, periodStart: period.startDate, periodEnd: period.endDate, directSales, directProfit, jumiaSales, kilimallSales: 0 });

  const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.startDate, periodEnd: period.endDate } } });

  console.log(JSON.stringify({
    user: { id: user.id, email },
    period: { id: period.id, start: period.startDate, end: period.endDate },
    aggregates: { directSales, directProfit, jumiaSales, jumiaProfit },
    computed,
    ledger: ledger ? { id: ledger.id, grossCommission: String(ledger.grossCommission), netCommission: String(ledger.netCommission), commissionTotal: ledger.commissionTotal, detail: ledger.detail } : null,
  }, null, 2));
}

const EMAIL = process.argv[2] || 'brendah@betech.co.ke';
main(EMAIL).then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
