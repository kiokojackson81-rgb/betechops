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
    startYear = year; startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear(); endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear(); startMonth = prev.getMonth();
    endYear = year; endMonth = month;
  }
  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  const label = `${start.toLocaleDateString('en-US')} – ${end.toLocaleDateString('en-US')}`;
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  return { start, end, label, key };
}

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

function computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, fallbackPercent = 0.05) {
  if (!tiers || tiers.length === 0) {
    if (!fallbackPercent || fallbackPercent <= 0) return 0;
    return fallbackPercent * totalProfit;
  }
  const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);
  const firstTierMin = sorted[0].minSales;
  if (totalSales < firstTierMin) {
    if (!fallbackPercent || fallbackPercent <= 0) return 0;
    return fallbackPercent * totalProfit;
  }
  let commission = 0;
  let previousMaxSales = sorted[0].minSales;
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const bandStart = i === 0 ? tier.minSales : previousMaxSales;
    const bandEnd = tier.maxSales ?? tier.minSales;
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

async function getOrCreateCommissionPeriod(date) {
  const tradingPeriod = getTradingPeriodFor(date);
  const { start, end, label: periodLabel } = tradingPeriod;
  let period = await prisma.commissionPeriod.findFirst({ where: { startDate: start, endDate: end } });
  if (!period) {
    period = await prisma.commissionPeriod.create({ data: { name: periodLabel, startDate: start, endDate: end } });
  }
  let tiers = await prisma.commissionTier.findMany({ where: { periodId: period.id }, orderBy: { minSales: 'asc' } });
  if (!tiers || tiers.length === 0) {
    await prisma.commissionTier.createMany({ data: DEFAULT_TIERS.map(t => ({ periodId: period.id, minSales: t.minSales, maxSales: t.maxSales, payoutFlat: t.payoutFlat })) });
    tiers = await prisma.commissionTier.findMany({ where: { periodId: period.id }, orderBy: { minSales: 'asc' } });
  }
  return { period, tiers, tradingPeriod };
}

async function summarizeWeeklySalesForPeriod(userId, period) {
  const rows = await prisma.weeklySale.findMany({ where: { userId, status: 'APPROVED', AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }] }, select: { amount: true } });
  if (!rows || rows.length === 0) return { totalSales: 0, entries: 0 };
  const totalSales = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  return { totalSales, entries: rows.length };
}

async function recomputeForUser(userId, period) {
  const summary = await summarizeWeeklySalesForPeriod(userId, period);
  if (!summary.entries || summary.totalSales <= 0) {
    return { updated: false, totalSales: summary.totalSales, payout: 0, ledgerId: null };
  }

  const { period: commissionPeriod, tiers } = await getOrCreateCommissionPeriod(period.start);
  const payout = computeSalesCommissionFromTiers(summary.totalSales, summary.totalSales, tiers, 0);

  const existingCommission = await prisma.attendantCommission.findFirst({ where: { userId, periodId: commissionPeriod.id, shopId: null } });
  if (existingCommission) {
    await prisma.attendantCommission.update({ where: { id: existingCommission.id }, data: { sales: summary.totalSales, payout } });
  } else {
    await prisma.attendantCommission.create({ data: { userId, periodId: commissionPeriod.id, shopId: null, sales: summary.totalSales, payout } });
  }

  const existingLedger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId, periodStart: period.start, periodEnd: period.end } } });
  const nextDetail = (existingLedger && typeof existingLedger.detail === 'object' && existingLedger.detail !== null && !Array.isArray(existingLedger.detail)) ? { ...existingLedger.detail } : {};
  const prevWeeklyRaw = nextDetail.onlineWeekly;
  const previousWeekly = (typeof prevWeeklyRaw === 'object' && prevWeeklyRaw !== null && !Array.isArray(prevWeeklyRaw)) ? prevWeeklyRaw : null;
  const previousCommission = (previousWeekly && typeof previousWeekly.commission === 'number') ? previousWeekly.commission : Number(nextDetail.onlineWeeklyCommission ?? 0);
  const baseGross = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousCommission ?? 0));
  const grossCommission = baseGross + payout;
  const penalties = Number(existingLedger?.penalties ?? 0);
  const netCommission = grossCommission - penalties;

  nextDetail.onlineWeekly = { periodKey: period.key, totals: summary, commission: payout, computedAt: new Date().toISOString() };
  nextDetail.onlineWeeklyCommission = payout;

  const ledger = await prisma.commissionLedger.upsert({
    where: { userId_periodStart_periodEnd: { userId, periodStart: period.start, periodEnd: period.end } },
    update: { grossCommission: grossCommission.toString(), netCommission: netCommission.toString(), detail: nextDetail },
    create: { userId, periodStart: period.start, periodEnd: period.end, grossCommission: grossCommission.toString(), netCommission: netCommission.toString(), detail: nextDetail },
  });

  return { updated: true, totalSales: summary.totalSales, payout, ledgerId: ledger.id };
}

async function main() {
  try {
    const period = getTradingPeriodFor(new Date());
    console.log('Period:', period.key, period.label);

    const distinctUsers = await prisma.weeklySale.findMany({ where: { userId: { not: null }, status: 'APPROVED', AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }] }, select: { userId: true }, distinct: ['userId'] });
    console.log('Distinct users to process:', distinctUsers.length);

    const results = [];
    for (const e of distinctUsers) {
      const uid = e.userId;
      try {
        const res = await recomputeForUser(uid, period);
        results.push({ userId: uid, ...res });
        console.log('Processed', uid, res);
      } catch (err) {
        console.error('Error processing', uid, err?.message || err);
        results.push({ userId: uid, error: String(err) });
      }
    }

    console.log('Summary:', { processed: results.filter(r => r.updated).length, total: results.length });
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Runner failed:', err);
    try { await prisma.$disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
