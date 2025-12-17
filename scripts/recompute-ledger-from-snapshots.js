const { PrismaClient } = require('@prisma/client');

function toNumber(v) {
  if (v === null || typeof v === 'undefined') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  const label = `${start.toLocaleDateString('en-US',{day:'2-digit',month:'short',year:'numeric'})} – ${end.toLocaleDateString('en-US',{day:'2-digit',month:'short',year:'numeric'})}`;
  return { start, end, key, label };
}

const DEFAULT_TIERS = [
  { minSales: 500_000, maxSales: 1_000_000, payoutFlat: 10000 },
  { minSales: 2_000_000, maxSales: 2_000_000, payoutFlat: 15000 },
  { minSales: 3_000_000, maxSales: 3_000_000, payoutFlat: 20000 },
  { minSales: 4_000_000, maxSales: 4_000_000, payoutFlat: 20000 },
  { minSales: 5_000_000, maxSales: 5_000_000, payoutFlat: 20000 },
  { minSales: 6_000_000, maxSales: 6_000_000, payoutFlat: 20000 },
  { minSales: 7_000_000, maxSales: 7_000_000, payoutFlat: 20000 },
  { minSales: 8_000_000, maxSales: 8_000_000, payoutFlat: 20000 },
  { minSales: 9_000_000, maxSales: 9_000_000, payoutFlat: 20000 },
  { minSales: 10_000_000, maxSales: 10_000_000, payoutFlat: 20000 },
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
    const bandStart = Math.max(tier.minSales, previousMaxSales);
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

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2] || 'brendah@betech.co.ke';
  console.log(`Recompute ledger from profit snapshots for ${email}`);
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.error('User not found:', email); process.exitCode = 2; return; }

    const now = new Date();
    const period = getTradingPeriodFor(now);

    // get commission period tiers if present
    const periodRow = await prisma.commissionPeriod.findFirst({ where: { startDate: period.start, endDate: period.end } });
    let tiers = DEFAULT_TIERS;
    if (periodRow) {
      const rows = await prisma.commissionTier.findMany({ where: { periodId: periodRow.id }, orderBy: { minSales: 'asc' } });
      if (rows && rows.length > 0) {
        tiers = rows.map((r) => ({ minSales: Number(r.minSales), maxSales: Number(r.maxSales), payoutFlat: Number(r.payoutFlat) }));
      }
    }

    // gather profitSnapshots for attendant via order -> orderItem -> profitSnapshot
    const snapshots = await prisma.profitSnapshot.findMany({
      where: { orderItem: { order: { attendantId: user.id, createdAt: { gte: period.start, lte: period.end } } } },
      select: { revenue: true, profit: true },
    });
    let totalSales = 0; let totalProfit = 0;
    for (const s of snapshots) { totalSales += toNumber(s.revenue); totalProfit += toNumber(s.profit); }

    // product commissions from dailyReport
    const reports = await prisma.dailyReport.findMany({ where: { userId: user.id, date: { gte: period.start, lte: period.end } }, select: { newProducts: true, productsEdited: true, copiesUploaded: true } });
    let newProducts = 0, editedProducts = 0, copiedProducts = 0;
    for (const r of reports) { newProducts += r.newProducts ?? 0; editedProducts += r.productsEdited ?? 0; copiedProducts += r.copiesUploaded ?? 0; }

    const fallbackPercent = totalProfit > 0 ? 0.05 : 0;
    const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, fallbackPercent);
    const newProductCommission = Math.min(Math.max(0, newProducts - 2000) * 3, 10000);
    const copiedCommission = Math.floor(copiedProducts / 5);
    const editedCommission = Math.floor(editedProducts / 10);
    const grossCommission = salesCommission + newProductCommission + copiedCommission + editedCommission;

    console.log('period', period.key, 'sales', totalSales, 'profit', totalProfit, 'salesCommission', salesCommission, 'grossCommission', grossCommission);

    // upsert ledger preserving existing detail except marketing
    const existing = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } } });
    const existingDetail = existing && typeof existing.detail === 'object' ? { ...existing.detail } : {};
    const previousMarketing = existingDetail.marketing ?? null;
    const previousMarketingCommission = toNumber(previousMarketing?.commission);
    const grossBeforeMarketing = Math.max(0, toNumber(existing?.grossCommission) - previousMarketingCommission);
    const grossCommissionNew = grossBeforeMarketing + salesCommission;
    const penalties = toNumber(existing?.penalties);
    const netCommission = grossCommissionNew - penalties;

    const nextDetail = { ...existingDetail, marketing: { periodKey: period.key, totals: { totalSales, totalProfit }, commission: salesCommission, computedAt: new Date().toISOString() } };

    const ledger = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } },
      update: {
        grossCommission: grossCommissionNew.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: (Number(existing?.commissionTotal ?? 0) - previousMarketingCommission + salesCommission).toFixed(2),
        detail: nextDetail,
      },
      create: {
        userId: user.id,
        periodStart: period.start,
        periodEnd: period.end,
        grossCommission: grossCommissionNew.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: salesCommission.toFixed(2),
        detail: nextDetail,
      },
    });

    console.log('Upserted ledger id:', ledger.id, 'commissionTotal:', ledger.commissionTotal);

  } catch (e) {
    console.error('Failed:', e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
