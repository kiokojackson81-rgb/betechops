const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

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

async function main() {
  const email = process.argv[2] || 'brendah@betech.co.ke';
  const apply = process.argv.includes('--apply');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('user not found: ' + email);

  const now = new Date();
  let period = await prisma.commissionPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
  if (!period) {
    // fallback: use most recent commission period
    period = await prisma.commissionPeriod.findFirst({ orderBy: { startDate: 'desc' } });
    if (!period) throw new Error('no commission periods found in DB');
    console.warn('No active period matched today; falling back to most recent period:', period.id);
  }

  // fetch receipts keyed by receiptKey or receiptNumber|method
  const support = await prisma.supportReceipt.findMany({ where: { dailyEntry: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } } }, select: { id: true, receiptNumber: true, paymentMethod: true, sellingTotal: true, buyingTotal: true, dailyEntryId: true } });
  const marketing = await prisma.marketingReceipt.findMany({ where: { dailyEntry: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } } }, select: { id: true, receiptNumber: true, paymentMethod: true, sellingTotal: true, buyingTotal: true, dailyEntryId: true } });

  const norm = (r) => `${String(r.receiptNumber||r.id).trim()}|${String(r.paymentMethod||'MPESA')}`;
  const supportMap = new Map(support.map(s => [norm(s), s]));

  // Identify overlapping marketing receipts that are actually support (same receipt+method)
  const marketingFiltered = marketing.filter(m => !supportMap.has(norm(m)));

  const supportTotals = support.reduce((acc, r) => { const sell = Number(r.sellingTotal||0); const buy = Number(r.buyingTotal||0); acc.sales += sell; acc.profit += (sell - buy); acc.count += 1; return acc; }, { sales:0, profit:0, count:0 });
  const marketingTotals = marketingFiltered.reduce((acc, r) => { const sell = Number(r.sellingTotal||0); const buy = Number(r.buyingTotal||0); acc.sales += sell; acc.profit += (sell - buy); acc.count += 1; return acc; }, { sales:0, profit:0, count:0 });

  const computedSupport = computeDirectCommission(supportTotals.sales, supportTotals.profit);
  const computedMarketing = computeMarketplaceCommission(marketingTotals.sales);

  // compute product-upload / copy / edit commissions from DailyReport rows
  function computeProductCommissions({ newProducts, copiedProducts, editedProducts }) {
    const eligibleNew = Math.max(0, (newProducts || 0) - 2000);
    const newProductCommission = Math.min(eligibleNew * 3, 10000);
    const copiedCommission = Math.floor((copiedProducts || 0) / 5);
    const editedCommission = Math.floor((editedProducts || 0) / 10);
    return { newProductCommission, copiedCommission, editedCommission, total: newProductCommission + copiedCommission + editedCommission };
  }

  const reports = await prisma.dailyReport.findMany({ where: { userId: user.id, date: { gte: period.startDate, lte: period.endDate } }, select: { newProducts: true, copiesUploaded: true, productsEdited: true } });
  const productCounts = reports.reduce((acc, r) => { acc.newProducts += Number(r.newProducts || 0); acc.copiedProducts += Number(r.copiesUploaded || 0); acc.editedProducts += Number(r.productsEdited || 0); return acc; }, { newProducts: 0, copiedProducts: 0, editedProducts: 0 });
  const productCommissions = computeProductCommissions(productCounts);

  // include product commissions in suggested total
  const suggestedCombined = computedSupport.amount + computedMarketing.amount + productCommissions.total;

  const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.startDate, periodEnd: period.endDate } } });

  const suggestion = {
    user: { id: user.id, email },
    period: { id: period.id, start: period.startDate, end: period.endDate },
    support: { receipts: supportTotals.count, sales: supportTotals.sales, profit: supportTotals.profit, computed: computedSupport },
    marketing: { receipts: marketingTotals.count, sales: marketingTotals.sales, profit: marketingTotals.profit, computed: computedMarketing },
    products: { counts: productCounts, commissions: productCommissions },
    suggestedCombined: suggestedCombined,
    existingLedger: ledger ? { id: ledger.id, grossCommission: String(ledger.grossCommission), netCommission: String(ledger.netCommission), detail: ledger.detail } : null,
  };

  console.log('Suggestion:', JSON.stringify(suggestion, null, 2));

  if (apply) {
    console.log('\nApplying suggestion via Prisma update...');
    const existingDetail = (ledger && ledger.detail) ? ledger.detail : {};
    const supportDetail = {
      periodKey: period.key || `${period.startDate.toISOString()}_${period.endDate.toISOString()}`,
      totals: { totalSales: suggestion.support.sales, totalProfit: suggestion.support.profit, totalReceipts: suggestion.support.receipts },
      commission: suggestion.support.computed.amount,
      computedAt: new Date().toISOString(),
    };

    const newDetail = { ...existingDetail, support: supportDetail };

    await prisma.commissionLedger.update({
      where: {
        userId_periodStart_periodEnd: {
          userId: user.id,
          periodStart: period.startDate,
          periodEnd: period.endDate,
        },
      },
      data: {
        grossCommission: suggestion.suggestedCombined,
        netCommission: suggestion.suggestedCombined,
        commissionTotal: suggestion.suggestedCombined,
        detail: newDetail,
      },
    });

    console.log('Applied via Prisma update.');
    const updated = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.startDate, periodEnd: period.endDate } } });
    console.log('Updated ledger row:', JSON.stringify({ id: updated.id, grossCommission: String(updated.grossCommission), netCommission: String(updated.netCommission), commissionTotal: String(updated.commissionTotal), detail: updated.detail }, null, 2));
  } else {
    const out = `suggestion_${user.id}_${period.id}.json`;
    fs.writeFileSync(out, JSON.stringify({ suggestion }, null, 2));
    console.log('Wrote suggestion JSON:', out);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
