import { PrismaClient } from '@prisma/client';

function toNumber(value: unknown): number {
  if (value === null || typeof value === 'undefined') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMethod(method: unknown): 'CASH' | 'MPESA' {
  if (typeof method !== 'string') return 'MPESA';
  return method.toUpperCase() === 'CASH' ? 'CASH' : 'MPESA';
}

function getTradingPeriodFor(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear: number;
  let startMonth: number;
  let endYear: number;
  let endMonth: number;

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

const COMMISSION_LADDER: { min: number; reward: number }[] = [
  { min: 1_000_000, reward: 10_000 },
  { min: 2_000_000, reward: 15_000 },
  { min: 3_000_000, reward: 20_000 },
  { min: 4_000_000, reward: 20_000 },
  { min: 5_000_000, reward: 20_000 },
  { min: 6_000_000, reward: 20_000 },
  { min: 7_000_000, reward: 20_000 },
  { min: 8_000_000, reward: 20_000 },
  { min: 9_000_000, reward: 20_000 },
  { min: 10_000_000, reward: 20_000 },
];

function calculateCumulativeCommission(totalSales: number) {
  const tiersReached = COMMISSION_LADDER.filter((t) => t.min <= totalSales);
  const commission = tiersReached.reduce((s, t) => s + t.reward, 0);
  const nextTier = COMMISSION_LADDER.find((t) => t.min > totalSales) || null;
  return { commission, nextTarget: nextTier?.min ?? null, tiersReached: tiersReached.map((t) => `${t.min}`), nextTierReward: nextTier?.reward ?? null };
}

function deriveReceiptsFromSales(sales: { receiptNumber: string | null; paymentMethod: string | null }[]) {
  if (!sales.length) return 0;
  const keys = new Set<string>();
  sales.forEach((sale, index) => {
    const method = normalizeMethod(sale.paymentMethod);
    const receiptKey = sale.receiptNumber && sale.receiptNumber.trim().length > 0 ? sale.receiptNumber.trim() : `unnamed-${index}`;
    keys.add(`${receiptKey}|${method}`);
  });
  return keys.size || 1;
}

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2] || 'brendah@betech.co.ke';
  console.log(`Recompute (local) for ${email}`);
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found:', email);
      process.exitCode = 2;
      return;
    }

    const period = getTradingPeriodFor(new Date());

    const [marketingEntries, reports] = await Promise.all([
      prisma.marketingDailyEntry.findMany({
        where: { submittedById: user.id, date: { gte: period.start, lte: period.end } },
        include: { receipts: { include: { items: true } }, sales: true },
      }),
      prisma.dailyReport.findMany({ where: { userId: user.id, date: { gte: period.start, lte: period.end } }, include: { sales: true } }),
    ]);

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
    } as any;

    for (const entry of marketingEntries) {
      const receipts = entry.receipts ?? [];
      if (receipts.length > 0) {
        for (const receipt of receipts) {
          const selling = toNumber(receipt.sellingTotal);
          totals.totalSales += selling;
          const items = receipt.items ?? [];
          const fallbackCost = items.reduce((s: number, it: any) => s + toNumber(it.buyingPrice), 0);
          const aggregateCost = toNumber(receipt.buyingTotal);
          const hasAggregateCost = aggregateCost > 0;
          const allItemsPriced = items.length > 0 && items.every((it: any) => toNumber(it.buyingPrice) > 0);
          if (hasAggregateCost || allItemsPriced) {
            const costToUse = hasAggregateCost ? aggregateCost : fallbackCost;
            totals.totalProfit += selling - costToUse;
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
        }
        continue;
      }
      const sales = entry.sales ?? [];
      if (sales.length > 0) {
        const receiptTracker = new Set<string>();
        sales.forEach((sale: any, index: number) => {
          const selling = toNumber(sale.sellingPrice);
          const buying = toNumber(sale.buyingPrice);
          const itemsCount = Number(sale.itemsCount ?? 1);
          totals.totalSales += selling;
          if (buying > 0) totals.totalProfit += selling - buying;
          totals.totalItems += itemsCount;
          const method = normalizeMethod(sale.paymentMethod);
          if (method === 'CASH') totals.paymentStats.totalSalesCash += selling; else totals.paymentStats.totalSalesMpesa += selling;
          const receiptKey = sale.receiptNumber && sale.receiptNumber.trim().length > 0 ? `${sale.receiptNumber.trim()}|${method}` : `${entry.id}-${index}|${method}`;
          if (!receiptTracker.has(receiptKey)) {
            receiptTracker.add(receiptKey);
            if (method === 'CASH') totals.paymentStats.countCashReceipts += 1; else totals.paymentStats.countMpesaReceipts += 1;
          }
        });
        totals.totalReceipts += (Array.from(receiptTracker).length || sales.length);
        continue;
      }
      totals.totalSales += toNumber(entry.totalSales);
      totals.totalProfit += toNumber(entry.totalProfit);
      totals.totalReceipts += 1;
    }

    for (const report of reports) {
      const tasks: any = (report as any).tasks ?? {};
      const metrics: any = tasks.metrics ?? {};
      const totalsJson: any = tasks.totals ?? {};
      const profitFromMetrics = toNumber(metrics.totalProfit) || toNumber(metrics.profit) || toNumber(totalsJson.profit) || 0;
      const entryProfit = profitFromMetrics > 0 ? profitFromMetrics : 0;
      const receiptsFromMetrics = Math.max(0, Math.floor(toNumber(totalsJson.receipts)));
      const derivedReceipts = deriveReceiptsFromSales(report.sales as any[]);
      const receiptCount = receiptsFromMetrics > 0 ? receiptsFromMetrics : derivedReceipts;

      totals.totalSales += toNumber(report.totalSales);
      totals.totalProfit += entryProfit;
      totals.totalReceipts += receiptCount;
      totals.totalItems += report.sales.length;
      totals.totalNewProducts += report.newProducts ?? 0;
      totals.totalEditedProducts += report.productsEdited ?? 0;
      totals.totalCopiedProducts += report.copiesUploaded ?? 0;
      totals.walkInsServed += report.walkInServed ?? 0;
      totals.walkInsPurchased += report.purchasesMade ?? 0;

      const receiptTracker = new Set<string>();
      for (const [index, sale] of report.sales.entries()) {
        const method = normalizeMethod(sale.paymentMethod);
        const price = toNumber(sale.price);
        if (method === 'CASH') totals.paymentStats.totalSalesCash += price; else totals.paymentStats.totalSalesMpesa += price;
        const receiptKey = sale.receiptNumber && sale.receiptNumber.trim().length > 0 ? `${sale.receiptNumber.trim()}|${method}` : `${report.id}-${index}|${method}`;
        if (!receiptTracker.has(receiptKey)) {
          receiptTracker.add(receiptKey);
          if (method === 'CASH') totals.paymentStats.countCashReceipts += 1; else totals.paymentStats.countMpesaReceipts += 1;
        }
      }
    }

    let marketingCommission = 0;
    if (totals.totalProfit > 0) {
      const info = calculateCumulativeCommission(totals.totalSales);
      const baseCommission = info.commission ?? 0;
      const fallbackCommission = baseCommission === 0 && totals.totalSales > 0 && totals.totalSales < 500_000 ? Math.round(Math.max(totals.totalProfit, 0) * 0.05) : 0;
      marketingCommission = baseCommission > 0 ? baseCommission : fallbackCommission;
    }

    if (marketingCommission === 0 && totals.totalSales === 0) {
      console.log('Nothing to upsert (no sales/commission)');
      return;
    }

    const existingLedger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } } });
    const previousDetail: any = existingLedger?.detail ?? {};
    const previousMarketing: any = previousDetail?.marketing ?? null;
    const previousMarketingCommission = toNumber(previousMarketing?.commission);
    const grossBeforeMarketing = Math.max(0, toNumber(existingLedger?.grossCommission) - previousMarketingCommission);
    const grossCommission = grossBeforeMarketing + marketingCommission;
    const penalties = toNumber(existingLedger?.penalties);
    const netCommission = grossCommission - penalties;

    const nextDetail = { ...(existingLedger?.detail ?? {}), marketing: { periodKey: period.key, totals, commission: marketingCommission, computedAt: new Date().toISOString() } };

    const ledger = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } },
      update: {
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - previousMarketingCommission + marketingCommission).toFixed(2),
        detail: nextDetail,
      },
      create: {
        userId: user.id,
        periodStart: period.start,
        periodEnd: period.end,
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: marketingCommission.toFixed(2),
        detail: nextDetail,
      },
    });

    console.log('Recompute result:', { updated: true, commission: marketingCommission, ledgerId: ledger.id });
  } catch (e) {
    console.error('Recompute failed:', e);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (_) {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
