const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  if (!totalSales || totalSales <= 0) return {amount:0, mode:'none'};
  if (totalSales < 500000){
    const profit = Math.max(totalProfit||0,0);
    const amount = Math.round(profit * 0.05);
    return { amount, mode: amount>0 ? 'direct_fallback' : 'none' };
  }
  return { amount: progressiveAmount(totalSales), mode: 'direct_progressive' };
}

async function main(email){
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('user not found', email); process.exit(1); }

  const now = new Date();
  const period = await prisma.commissionPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
  if (!period) { console.error('no active commission period found'); process.exit(1); }

  const totalsAgg = await prisma.supportDailyEntry.aggregate({
    where: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } },
    _sum: { totalSales: true, totalProfit: true },
  });

  const directSales = Number(totalsAgg._sum.totalSales ?? 0);
  const directProfit = Number(totalsAgg._sum.totalProfit ?? 0);

  const computed = computeDirectCommission(directSales, directProfit);

  const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.startDate, periodEnd: period.endDate } } });

  console.log(JSON.stringify({
    user: { id: user.id, email },
    period: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
    direct: { sales: directSales, profit: directProfit },
    computedDirectCommission: computed,
    ledger: ledger ? { id: ledger.id, grossCommission: String(ledger.grossCommission), netCommission: String(ledger.netCommission), commissionDirect: ledger.commissionDirect ? String(ledger.commissionDirect) : null, detail: ledger.detail } : null,
  }, null, 2));
}

const EMAIL = process.argv[2] || 'brendah@betech.co.ke';
main(EMAIL).then(()=>prisma.$disconnect()).catch((e)=>{ console.error(e); prisma.$disconnect(); process.exit(1); });
