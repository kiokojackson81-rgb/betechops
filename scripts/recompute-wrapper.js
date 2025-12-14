const { PrismaClient } = require('@prisma/client');

function toNumber(v) {
  if (v === null || typeof v === 'undefined') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMethod(method) {
  if (typeof method !== 'string') return 'MPESA';
  return method.toUpperCase() === 'CASH' ? 'CASH' : 'MPESA';
}

function deriveReceiptsFromSales(sales) {
  if (!sales || sales.length === 0) return 0;
  const keys = new Set();
  sales.forEach((sale, idx) => {
    const method = normalizeMethod(sale.paymentMethod);
    const receiptKey = sale.receiptNumber && String(sale.receiptNumber).trim().length > 0 ? String(sale.receiptNumber).trim() : `unnamed-${idx}`;
    keys.add(`${receiptKey}|${method}`);
  });
  return keys.size || 1;
}

function getTradingPeriodFor(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear, startMonth, endYear, endMonth;
  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  return { start, end, key };
}

const COMMISSION_LADDER = [
  { min: 1000000, reward: 10000 },
  { min: 2000000, reward: 15000 },
  { min: 3000000, reward: 20000 },
  { min: 4000000, reward: 20000 },
  { min: 5000000, reward: 20000 },
  { min: 6000000, reward: 20000 },
  { min: 7000000, reward: 20000 },
  { min: 8000000, reward: 20000 },
  { min: 9000000, reward: 20000 },
  { min: 10000000, reward: 20000 },
];

function calculateCumulativeCommission(totalSales) {
  const tiersReached = COMMISSION_LADDER.filter((t) => t.min <= totalSales);
  const commission = tiersReached.reduce((s, t) => s + t.reward, 0);
  const nextTier = COMMISSION_LADDER.find((t) => t.min > totalSales) || null;
  return { commission, tiersReached: tiersReached.map((t) => `${t.min}`), nextTarget: nextTier ? nextTier.min : null, nextTierReward: nextTier ? nextTier.reward : null };
}

async function summarize(prisma, userId, period) {
  const totals = {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    totalNewProducts: 0,
    totalEditedProducts: 0,
    totalCopiedProducts: 0,
    walkInsServed: 0,
    walkInsPurchased: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
  };

  const [marketingEntries, reports] = await Promise.all([
    prisma.marketingDailyEntry.findMany({
      where: { submittedById: userId, date: { gte: period.start, lte: period.end } },
      include: { receipts: { include: { items: true } }, sales: true },
    }),
    prisma.dailyReport.findMany({ where: { userId, date: { gte: period.start, lte: period.end } }, include: { sales: true } }),
  ]);

  marketingEntries.forEach((entry) => {
    const receipts = entry.receipts || [];
    if (receipts.length > 0) {
      receipts.forEach((receipt) => {
        const selling = toNumber(receipt.sellingTotal);
        totals.totalSales += selling;
        const items = receipt.items || [];
        const allItemsPriced = items.every((it) => toNumber(it.buyingPrice) > 0);
        if (allItemsPriced) {
          const buyingSum = items.reduce((s, it) => s + toNumber(it.buyingPrice), 0);
          totals.totalProfit += selling - buyingSum;
        }
        totals.totalItems += items.length;
        totals.totalReceipts += 1;
        const method = normalizeMethod(receipt.paymentMethod);
        if (method === 'CASH') {
          totals.paymentStats.totalSalesCash += selling;
          totals.paymentStats.countCashReceipts += 1;
        } else {
          totals.paymentStats.totalSalesMpesa += selling;
          totals.paymentStats.countMpesaReceipts += 1;
        }
      });
      return;
    }

    const sales = entry.sales || [];
    if (sales.length > 0) {
      const receiptTracker = new Set();
      sales.forEach((sale, idx) => {
        const selling = toNumber(sale.sellingPrice);
        const buying = toNumber(sale.buyingPrice);
        const itemsCount = Number(sale.itemsCount || 1);
        totals.totalSales += selling;
        if (buying > 0) totals.totalProfit += selling - buying;
        totals.totalItems += itemsCount;
        const method = normalizeMethod(sale.paymentMethod);
        if (method === 'CASH') totals.paymentStats.totalSalesCash += selling; else totals.paymentStats.totalSalesMpesa += selling;
        const receiptKey = sale.receiptNumber && String(sale.receiptNumber).trim().length > 0 ? `${String(sale.receiptNumber).trim()}|${method}` : `${entry.id}-${idx}|${method}`;
        if (!receiptTracker.has(receiptKey)) {
          receiptTracker.add(receiptKey);
          if (method === 'CASH') totals.paymentStats.countCashReceipts += 1; else totals.paymentStats.countMpesaReceipts += 1;
        }
      });
      totals.totalReceipts += receiptTracker.size || sales.length;
      return;
    }

    totals.totalSales += toNumber(entry.totalSales);
    totals.totalProfit += toNumber(entry.totalProfit);
    totals.totalReceipts += 1;
  });

  reports.forEach((report) => {
    const tasks = report.tasks && typeof report.tasks === 'object' ? report.tasks : {};
    const metrics = tasks.metrics && typeof tasks.metrics === 'object' ? tasks.metrics : {};
    const totalsJson = tasks.totals && typeof tasks.totals === 'object' ? tasks.totals : {};

    const profitFromMetrics = toNumber(metrics.totalProfit) || toNumber(metrics.profit) || toNumber(totalsJson.profit) || 0;
    const entryProfit = profitFromMetrics > 0 ? profitFromMetrics : 0;
    const receiptsFromMetrics = Math.max(0, Math.floor(toNumber(totalsJson.receipts)));
    const derivedReceipts = deriveReceiptsFromSales(report.sales || []);
    const receiptCount = receiptsFromMetrics > 0 ? receiptsFromMetrics : derivedReceipts;

    totals.totalSales += toNumber(report.totalSales);
    totals.totalProfit += entryProfit;
    totals.totalReceipts += receiptCount;
    totals.totalItems += (report.sales || []).length;
    totals.totalNewProducts += report.newProducts || 0;
    totals.totalEditedProducts += report.productsEdited || 0;
    totals.totalCopiedProducts += report.copiesUploaded || 0;
    totals.walkInsServed += report.walkInServed || 0;
    totals.walkInsPurchased += report.purchasesMade || 0;

    const receiptTracker = new Set();
    (report.sales || []).forEach((sale, idx) => {
      const method = normalizeMethod(sale.paymentMethod);
      const price = toNumber(sale.price);
      if (method === 'CASH') totals.paymentStats.totalSalesCash += price; else totals.paymentStats.totalSalesMpesa += price;
      const receiptKey = sale.receiptNumber && String(sale.receiptNumber).trim().length > 0 ? `${String(sale.receiptNumber).trim()}|${method}` : `${report.id}-${idx}|${method}`;
      if (!receiptTracker.has(receiptKey)) {
        receiptTracker.add(receiptKey);
        if (method === 'CASH') totals.paymentStats.countCashReceipts += 1; else totals.paymentStats.countMpesaReceipts += 1;
      }
    });
  });

  return { totals, entryCount: marketingEntries.length + reports.length };
}

async function recompute(emailArg, dateArg) {
  const prisma = new PrismaClient();
  try {
    // Args: [email] [date]
    const cliEmail = emailArg || process.argv[2];
    const cliDate = dateArg || process.argv[3] || process.env.RECOMPUTE_DATE;
    const email = cliEmail || process.env.USER_EMAIL || 'brendah@betech.co.ke';
    console.log('Running recompute for', email, cliDate ? `period date=${cliDate}` : '(current period)');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found:', email);
      process.exitCode = 2;
      return;
    }

    const period = cliDate ? getTradingPeriodFor(new Date(cliDate)) : getTradingPeriodFor(new Date());
    const { totals } = await summarize(prisma, user.id, period);
    const commissionInfo = calculateCumulativeCommission(totals.totalSales || 0);
    let marketingCommission = 0;
    if (totals.totalProfit > 0) {
      const baseCommission = commissionInfo.commission || 0;
      const fallbackCommission =
        baseCommission === 0 && totals.totalSales > 0 && totals.totalSales < 500000
          ? Math.round(Math.max(totals.totalProfit, 0) * 0.05)
          : 0;
      marketingCommission = baseCommission > 0 ? baseCommission : fallbackCommission;
    }

    if (marketingCommission === 0 && totals.totalSales === 0) {
      console.log('Nothing to update (zero sales).');
      return;
    }

    const existingLedger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } } });
    const previousMarketingCommission = existingLedger && existingLedger.detail && existingLedger.detail.marketing ? Number(existingLedger.detail.marketing.commission || 0) : 0;
    const grossBeforeMarketing = Math.max(0, toNumber(existingLedger ? existingLedger.grossCommission : 0) - previousMarketingCommission);
    const grossCommission = grossBeforeMarketing + marketingCommission;
    const penalties = toNumber(existingLedger ? existingLedger.penalties : 0);
    const netCommission = grossCommission - penalties;

    const nextDetail = Object.assign({}, existingLedger && existingLedger.detail ? existingLedger.detail : {}, { marketing: { periodKey: period.key, totals, commission: marketingCommission, computedAt: new Date().toISOString() } });

    const ledger = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } },
      update: { grossCommission: grossCommission.toFixed(2), netCommission: netCommission.toFixed(2), detail: nextDetail },
      create: { userId: user.id, periodStart: period.start, periodEnd: period.end, grossCommission: grossCommission.toFixed(2), netCommission: netCommission.toFixed(2), detail: nextDetail },
    });

    console.log('Updated ledger id=', ledger.id, 'commission=', marketingCommission, 'totals=', totals);
  } catch (e) {
    console.error('Recompute failed:', e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
}

recompute(process.argv[2]);
