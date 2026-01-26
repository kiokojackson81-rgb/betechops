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

function toNumber(v) {
  if (v === null || typeof v === 'undefined') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeReceiptNumber(v) {
  if (!v) return null;
  try { return String(v).trim(); } catch (e) { return null; }
}

function normalizePaymentMethod(v) {
  const s = (v || 'MPESA').toString().toUpperCase();
  if (s.includes('CASH')) return 'CASH';
  return 'MPESA';
}

function extractSales(totals, data, order) {
  return (
    toNumber(totals?.sellingTotal) ||
    toNumber(totals?.grandTotal) ||
    toNumber(totals?.total) ||
    toNumber(totals?.amount) ||
    toNumber(totals?.subtotal) ||
    toNumber(data?.total) ||
    toNumber(data?.amount) ||
    toNumber(order?.totalAmount) ||
    0
  );
}

function extractProfit(totals, data, sales) {
  const candidate =
    toNumber(totals?.profit) ||
    toNumber(data?.profit) ||
    (toNumber(totals?.sellingTotal) - toNumber(totals?.buyingTotal)) ||
    (toNumber(data?.sellingTotal) - toNumber(data?.buyingTotal));
  if (candidate !== 0) return candidate;
  const buying = toNumber(totals?.buyingTotal) || toNumber(data?.buyingTotal);
  if (buying > 0) return sales - buying;
  return 0;
}

function countItems(order) {
  const items = order?.items || [];
  return items.reduce((s, it) => s + Math.max(1, Math.trunc(Number((it && it.quantity) || 1))), 0);
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
    const bandEnd = tier.maxSales == null ? tier.minSales : tier.maxSales;
    const bandWidth = Math.max(0, bandEnd - bandStart);
    if (bandWidth <= 0) {
      if (totalSales >= bandEnd) {
        commission += tier.payoutFlat;
        previousMaxSales = bandEnd;
        continue;
      } else {
        break;
      }
    }
    if (totalSales >= bandEnd) {
      commission += tier.payoutFlat;
    } else if (totalSales > bandStart) {
      const progress = (totalSales - bandStart) / bandWidth;
      commission += tier.payoutFlat * progress;
      return commission;
    } else {
      break;
    }
    previousMaxSales = bandEnd;
  }
  return commission;
}

(async () => {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'jeniffer@betech.co.ke' }, select: { id: true, email: true } });
    if (!user) return console.error('User not found');
    const period = (function() { const p = getTradingPeriodFor(new Date()); const prevEnd = new Date(p.start.getTime() - 24*60*60*1000); return getTradingPeriodFor(prevEnd); })();
    const start = period.start; const end = period.end;
    console.log('Recomputing direct-sales ledger for', user.email, 'period', start.toISOString(), '-', end.toISOString());

    // Ensure tiers exist for period
    let commissionPeriod = await prisma.commissionPeriod.findFirst({ where: { startDate: start, endDate: end } });
    if (!commissionPeriod) {
      commissionPeriod = await prisma.commissionPeriod.create({ data: { name: `${start.toISOString()}_${end.toISOString()}`, startDate: start, endDate: end } });
    }
    const existingTiers = await prisma.commissionTier.findMany({ where: { periodId: commissionPeriod.id }, orderBy: { minSales: 'asc' } });
    if (!existingTiers || existingTiers.length === 0) {
      const DEFAULT_TIERS = [
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
      await prisma.commissionTier.createMany({ data: DEFAULT_TIERS.map(t => ({ periodId: commissionPeriod.id, minSales: t.minSales, maxSales: t.maxSales, payoutFlat: t.payoutFlat })) });
    }
    const tiers = await prisma.commissionTier.findMany({ where: { periodId: commissionPeriod.id }, orderBy: { minSales: 'asc' } });

    // Summarize POS receipts
    const receipts = await prisma.receipt.findMany({ where: { generatedAt: { gte: start, lte: end } }, include: { order: { select: { orderNumber: true, totalAmount: true, items: { select: { quantity: true } } } } } });
    const seen = new Map();
    let totalSales = 0; let totalProfit = 0; let totalItems = 0;
    for (const r of receipts) {
      const key = normalizeReceiptNumber(r.receiptNumber) || normalizeReceiptNumber(r.order?.orderNumber) || r.id;
      if (seen.has(key)) continue;
      seen.set(key, r.id);
      const sales = extractSales(r.totals, r.data, r.order);
      totalSales += sales;
      totalProfit += extractProfit(r.totals, r.data, sales);
      totalItems += countItems(r.order);
    }

    // Jeniffer rule: fallbackPercent = 0
    const normalizedTiers = tiers.map(t => ({ minSales: Number(t.minSales), maxSales: t.maxSales == null ? null : Number(t.maxSales), payoutFlat: Number(t.payoutFlat) }));

    // Special Jeniffer behavior: prorate progress through the current band
    // so partial sales between previous target and next target earn a
    // proportional share of the next-tier flat payout.
    function computeJenifferCommission(totalSales, tiers) {
      if (!tiers || tiers.length === 0) return { commission: 0, baseCommission: 0, prorated: 0, nextTarget: null, progressPercent: 0 };
      const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);
      // Find index of first tier with minSales > totalSales
      let nextIdx = sorted.findIndex(t => t.minSales > totalSales);
      if (nextIdx === -1) {
        // All tiers reached; award full payouts for all
        const total = sorted.reduce((s, t) => s + t.payoutFlat, 0);
        return { commission: total, baseCommission: total, prorated: 0, nextTarget: null, progressPercent: 1 };
      }

      // Sum full payouts for tiers fully achieved (those before nextIdx)
      let baseCommission = 0;
      for (let i = 0; i < nextIdx; i++) {
        baseCommission += sorted[i].payoutFlat;
      }

      // If totalSales is below the first tier, no prorated portion applies
      if (nextIdx === 0) return { commission: baseCommission, baseCommission, prorated: 0, nextTarget: sorted[0].minSales, progressPercent: totalSales / sorted[0].minSales };

      const prev = sorted[nextIdx - 1];
      const next = sorted[nextIdx];
      const bandWidth = Math.max(1, next.minSales - prev.minSales);
      const progressInBand = Math.max(0, Math.min(1, (totalSales - prev.minSales) / bandWidth));
      const prorated = next.payoutFlat * progressInBand;
      const commission = baseCommission + prorated;
      return { commission, baseCommission, prorated, nextTarget: next.minSales, progressPercent: progressInBand };
    }

    let jenifferResult = null;
    if (user.email && user.email.toLowerCase() === 'jeniffer@betech.co.ke') {
      jenifferResult = computeJenifferCommission(totalSales, normalizedTiers);
    }
    const directCommission = jenifferResult ? jenifferResult.commission : computeSalesCommissionFromTiers(totalSales, totalProfit, normalizedTiers, 0);

    // Compute progress toward the next commission tier (auto-increment/projection)
    let progress = null;
    if (jenifferResult) {
      const nextTarget = jenifferResult.nextTarget;
      const progressPercent = jenifferResult.progressPercent;
      const projectedCommissionIfReached = jenifferResult.nextTarget ? (jenifferResult.baseCommission + normalizedTiers.find(t => t.minSales === jenifferResult.nextTarget).payoutFlat) : directCommission;
      const proratedEarned = jenifferResult.prorated;
      const remainingToNext = jenifferResult.nextTarget ? Math.max(0, normalizedTiers.find(t => t.minSales === jenifferResult.nextTarget).payoutFlat - proratedEarned) : 0;
      progress = { currentSales: totalSales, nextTarget, progressPercent, proratedEarned, remainingToNext, projectedCommissionIfReached };
    }

    // Upsert ledger merging directSales into existing
    const existingLedger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: start, periodEnd: end } } });
    const existingDetail = existingLedger && typeof existingLedger.detail === 'object' ? { ...(existingLedger.detail) } : {};
    const previousDirectCommission = existingDetail?.directSales?.commission ?? 0;
    const grossBefore = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousDirectCommission ?? 0));
    const grossCommission = grossBefore + directCommission;
    const penalties = Number(existingLedger?.penalties ?? 0);
    const netCommission = grossCommission - penalties;
    const nextDetail = { ...existingDetail, directSales: { periodKey: `${start.toISOString()}_${end.toISOString()}`, totals: { totalSales, totalProfit, totalItems }, commission: directCommission, progressToNextTier: progress, computedAt: new Date().toISOString() } };

    // delete overlapping ledgers referencing same periodKey but different start/end
    try {
      await prisma.$executeRaw`
        DELETE FROM "CommissionLedger"
        WHERE "userId" = ${user.id}
          AND (detail->'directSales'->>'periodKey') = ${nextDetail.directSales.periodKey}
          AND NOT ("periodStart" = ${start} AND "periodEnd" = ${end})
      `;
    } catch (e) {}

    const upsert = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: start, periodEnd: end } },
      update: {
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - Number(previousDirectCommission ?? 0) + directCommission).toFixed(2),
        detail: nextDetail,
      },
      create: {
        userId: user.id,
        periodStart: start,
        periodEnd: end,
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: directCommission.toFixed(2),
        detail: nextDetail,
      },
    });

    console.log('Recomputed direct-sales:', { totalSales, totalProfit, totalItems, directCommission, progress, ledgerId: upsert.id });
  } catch (e) {
    console.error('Error recomputing direct-sales ledger:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
