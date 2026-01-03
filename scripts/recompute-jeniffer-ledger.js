const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
  return { start, end };
}

function computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, fallbackPercent = 0.05) {
  if (!tiers || tiers.length === 0) {
    if (!fallbackPercent || fallbackPercent <= 0) return 0;
    return fallbackPercent * totalProfit;
  }
  const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);
  const firstTierMin = sorted[0].minSales;
  const baseSalesCap = firstTierMin;
  const profitWithinFirstBand = totalSales > 0 ? (Math.min(totalSales, baseSalesCap) / totalSales) * totalProfit : 0;
  const baseCommission = fallbackPercent && fallbackPercent > 0 ? fallbackPercent * profitWithinFirstBand : 0;
  let commission = baseCommission;
  if (totalSales <= firstTierMin) return commission;
  let previousMaxSales = sorted[0].minSales;
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const bandStart = Math.max(tier.minSales, previousMaxSales);
    const bandEnd = tier.maxSales ?? tier.minSales;
    const bandWidth = Math.max(0, bandEnd - bandStart);
    if (bandWidth <= 0) {
      if (totalSales >= bandEnd) {
        commission += tier.payoutFlat;
        previousMaxSales = bandEnd;
        continue;
      } else break;
    }
    if (totalSales >= bandEnd) {
      commission += tier.payoutFlat;
    } else if (totalSales > bandStart) {
      const progress = (totalSales - bandStart) / bandWidth;
      commission += tier.payoutFlat * progress;
      return commission;
    } else break;
    previousMaxSales = bandEnd;
  }
  return commission;
}

// Accept optional PERIOD_START and PERIOD_END environment variables (ISO date strings)
// If provided, the script will compute for that exact period; otherwise it uses current trading period.
(async () => {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'jeniffer@betech.co.ke' }, select: { id: true, email: true } });
    if (!user) return console.error('User not found: jeniffer@betech.co.ke');
    console.log('Found user', user.id);

    let period;
    if (process.env.PERIOD_START && process.env.PERIOD_END) {
      const s = new Date(process.env.PERIOD_START);
      const e = new Date(process.env.PERIOD_END);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        console.error('Invalid PERIOD_START or PERIOD_END');
        process.exit(1);
      }
      period = { start: s, end: e };
      console.log('Using provided period', period.start.toISOString(), period.end.toISOString());
    } else {
      period = getTradingPeriodFor(new Date());
      console.log('Using current trading period', period.start.toISOString(), period.end.toISOString());
    }

    // fetch receipts in period
    const receipts = await prisma.receipt.findMany({
      where: { generatedAt: { gte: period.start, lte: period.end } },
      include: { order: { select: { orderNumber: true, totalAmount: true, items: { select: { quantity: true } } } } },
    });

    // dedupe by normalized receipt number or orderNumber or id
    const normalize = (v) => (typeof v === 'string' && v && v.trim() ? v.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : null);
    const seen = new Map();
    let totalSales = 0;
    let totalProfit = 0;
    let totalItems = 0;
    for (const r of receipts) {
      const key = normalize(r.receiptNumber) || normalize(r.order?.orderNumber) || r.id;
      if (seen.has(key)) continue;
      seen.set(key, r.id);
      const totals = r.totals ?? {};
      const data = r.data ?? {};
      const sales = Number(totals.sellingTotal ?? totals.grandTotal ?? totals.total ?? totals.amount ?? data.total ?? data.amount ?? r.order?.totalAmount ?? 0) || 0;
      const buying = Number(totals.buyingTotal ?? data.buyingTotal ?? 0) || 0;
      const profit = buying > 0 ? sales - buying : 0;
      const items = Array.isArray(r.order?.items) ? r.order.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) : 0;
      totalSales += sales;
      totalProfit += profit;
      totalItems += items;
    }

    // fetch tiers for current commission period (seeded defaults exist)
    const commissionPeriod = await prisma.commissionPeriod.findFirst({ where: { startDate: period.start, endDate: period.end } });
    let tiers = [];
    if (commissionPeriod) {
      tiers = await prisma.commissionTier.findMany({ where: { periodId: commissionPeriod.id }, orderBy: { minSales: 'asc' } });
      tiers = tiers.map(t=>({ minSales: Number(t.minSales), maxSales: Number(t.maxSales), payoutFlat: Number(t.payoutFlat) }));
    } else {
      // fallback to defaults
      tiers = [
        { minSales: 500000, maxSales: 1000000, payoutFlat: 10000 },
        { minSales: 2000000, maxSales: 2000000, payoutFlat: 15000 },
        { minSales: 3000000, maxSales: 3000000, payoutFlat: 20000 },
        { minSales: 4000000, maxSales: 4000000, payoutFlat: 20000 },
        { minSales: 5000000, maxSales: 5000000, payoutFlat: 20000 },
        { minSales: 6000000, maxSales: 6000000, payoutFlat: 20000 },
        { minSales: 7000000, maxSales: 7000000, payoutFlat: 20000 },
        { minSales: 8000000, maxSales: 8000000, payoutFlat: 20000 },
        { minSales: 9000000, maxSales: 9000000, payoutFlat: 20000 },
        { minSales: 10000000, maxSales: 10000000, payoutFlat: 20000 },
      ];
    }

    const commission = Math.round(computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, 0));
    console.log('Totals', { totalSales, totalProfit, totalItems, totalReceipts: seen.size, commission });

    // upsert commission ledger for user
    const existing = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } } });
    const existingDetail = typeof existing?.detail === 'object' && existing?.detail ? { ...(existing.detail) } : {};
    const prevDirect = existingDetail.directSales?.commission ?? 0;
    const grossBefore = Math.max(0, Number(existing?.grossCommission ?? 0) - Number(prevDirect ?? 0));
    const grossCommission = grossBefore + commission;
    const penalties = Number(existing?.penalties ?? 0);
    const netCommission = grossCommission - penalties;
    const nextDetail = { ...existingDetail, directSales: { periodKey: `${period.start.toISOString()}_${period.end.toISOString()}`, totals: { totalSales, totalProfit, totalReceipts: seen.size, totalItems }, commission, computedAt: new Date().toISOString() } };

    // remove overlapping stale ledgers referencing same periodKey
    try {
      await prisma.$executeRaw`
        DELETE FROM "CommissionLedger"
        WHERE "userId" = ${user.id}
          AND (detail->'directSales'->>'periodKey') = ${nextDetail.directSales.periodKey}
          AND NOT ("periodStart" = ${period.start} AND "periodEnd" = ${period.end})
      `;
    } catch (e) {}

    const upsert = await prisma.commissionLedger.upsert({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } }, update: { grossCommission: grossCommission.toFixed(2), netCommission: netCommission.toFixed(2), commissionTotal: (Number(existing?.commissionTotal ?? 0) - Number(prevDirect ?? 0) + commission).toFixed(2), detail: nextDetail }, create: { userId: user.id, periodStart: period.start, periodEnd: period.end, grossCommission: grossCommission.toFixed(2), netCommission: netCommission.toFixed(2), commissionTotal: commission.toFixed(2), detail: nextDetail } });

    console.log('Upserted ledger id=', upsert.id);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
