const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
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
  if (!totalSales || totalSales <= 0) return { amount: 0, mode: 'none' };
  if (totalSales < 500000){
    const profit = Math.max(totalProfit||0,0);
    const amount = Math.round(profit * 0.05);
    return { amount, mode: amount>0 ? 'direct_fallback' : 'none' };
  }
  return { amount: progressiveAmount(totalSales), mode: 'direct_progressive' };
}
function computeMarketplaceCommission(totalSales){
  if (totalSales < 500000) return { amount: 0, mode: 'none' };
  return { amount: progressiveAmount(totalSales), mode: 'marketplace_progressive' };
}

async function main(email){
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('user not found: ' + email);

  const now = new Date();
  const period = await prisma.commissionPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
  if (!period) throw new Error('no active commission period found');

  const supportReceipts = await prisma.supportReceipt.findMany({
    where: { dailyEntry: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } } },
    include: { dailyEntry: true, items: true },
    orderBy: { createdAt: 'asc' },
  });

  const marketingReceipts = await prisma.marketingReceipt.findMany({
    where: { dailyEntry: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } } },
    include: { dailyEntry: true, items: true },
    orderBy: { createdAt: 'asc' },
  });

  let supportTotals = { sales: 0, profit: 0, count: 0 };
  let marketingTotals = { sales: 0, profit: 0, count: 0 };

  const rows = [];

  supportReceipts.forEach(r => {
    const buying = Number(r.buyingTotal || 0);
    const selling = Number(r.sellingTotal || 0);
    const profit = selling - buying;
    supportTotals.sales += selling;
    supportTotals.profit += profit;
    supportTotals.count += 1;
    rows.push({ id: r.id, channel: 'support', dailyEntryId: r.dailyEntryId, receiptNumber: r.receiptNumber || '', sellingTotal: selling, buyingTotal: buying, profit, paymentMethod: r.paymentMethod, createdAt: r.createdAt });
  });

  marketingReceipts.forEach(r => {
    const buying = Number(r.buyingTotal || 0);
    const selling = Number(r.sellingTotal || 0);
    const profit = selling - buying;
    marketingTotals.sales += selling;
    marketingTotals.profit += profit;
    marketingTotals.count += 1;
    rows.push({ id: r.id, channel: 'marketing', dailyEntryId: r.dailyEntryId, receiptNumber: r.receiptNumber || '', sellingTotal: selling, buyingTotal: buying, profit, paymentMethod: r.paymentMethod, createdAt: r.createdAt });
  });

  // Also include supportDailyEntry aggregates (authoritative for support in many flows)
  const supportEntryAgg = await prisma.supportDailyEntry.aggregate({ where: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } }, _sum: { totalSales: true, totalProfit: true } });
  const supportEntrySales = Number(supportEntryAgg._sum.totalSales ?? 0);
  const supportEntryProfit = Number(supportEntryAgg._sum.totalProfit ?? 0);

  const computedSupport = computeDirectCommission(supportEntrySales || supportTotals.sales, supportEntryProfit || supportTotals.profit);
  const computedMarketing = computeMarketplaceCommission(marketingTotals.sales);

  const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.startDate, periodEnd: period.endDate } } });

  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, `reconcile_brendah_receipts_${period.id}.csv`);
  const jsonPath = path.join(outDir, `reconcile_brendah_summary_${period.id}.json`);

  const header = 'id,channel,dailyEntryId,receiptNumber,sellingTotal,buyingTotal,profit,paymentMethod,createdAt\n';
  const csvLines = rows.map(r => `${r.id},${r.channel},${r.dailyEntryId},"${String(r.receiptNumber).replace(/"/g,'""')}",${r.sellingTotal},${r.buyingTotal},${r.profit},${r.paymentMethod},${r.createdAt.toISOString()}`);
  fs.writeFileSync(csvPath, header + csvLines.join('\n'));

  const summary = {
    user: { id: user.id, email },
    period: { id: period.id, start: period.startDate, end: period.endDate },
    supportReceiptsCount: supportTotals.count,
    marketingReceiptsCount: marketingTotals.count,
    supportTotals: { sales: supportTotals.sales, profit: supportTotals.profit },
    supportEntryTotals: { sales: supportEntrySales, profit: supportEntryProfit },
    marketingTotals: { sales: marketingTotals.sales, profit: marketingTotals.profit },
    computed: { support: computedSupport, marketing: computedMarketing, combined: computedSupport.amount + computedMarketing.amount },
    ledger: ledger ? { id: ledger.id, grossCommission: String(ledger.grossCommission), netCommission: String(ledger.netCommission), detail: ledger.detail } : null,
    csvPath,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  console.log('Wrote CSV:', csvPath);
  console.log('Wrote summary JSON:', jsonPath);
  console.log('Summary:', JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

const EMAIL = process.argv[2] || 'brendah@betech.co.ke';
main(EMAIL).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
