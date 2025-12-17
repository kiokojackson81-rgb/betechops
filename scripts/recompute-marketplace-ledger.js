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

  let startYear;
  let startMonth;
  let endYear;
  let endMonth;

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

// Use the same ladder helper as server: cumulative ladder
function calculateCumulativeCommission(totalSales) {
  const ladder = [
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
  const tiersReached = ladder.filter((t) => t.min <= totalSales);
  const commission = tiersReached.reduce((s, t) => s + t.reward, 0);
  return { commission };
}

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.USER_EMAIL || process.argv[2] || 'brendah@betech.co.ke';
  console.log('Running marketplace-ledger recompute for', email);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('User not found:', email);
      process.exitCode = 2;
      return;
    }

    const period = getTradingPeriodFor(new Date());

    // Find active assignments for this attendant
    const now = new Date();
    const assignments = await prisma.marketplaceAccountAssignment.findMany({
      where: { attendantId: user.id, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      select: { accountId: true },
    });
    const accountIds = assignments.map((a) => a.accountId);
    if (!accountIds.length) {
      console.log('No marketplace accounts assigned to user; nothing to compute');
      return;
    }

    // Sum grossSales from payout weeks for these accounts in the trading period
    const payoutWeeks = await prisma.marketplacePayoutWeek.findMany({
      where: { accountId: { in: accountIds }, weekEnd: { gte: period.start, lte: period.end } },
      select: { grossSales: true },
    });
    const marketplaceSales = payoutWeeks.reduce((s, w) => s + toNumber(w.grossSales), 0);

    // Also include approved manual weeklySale entries overlapping the period
    const manual = await prisma.weeklySale.findMany({
      where: { status: 'APPROVED', source: 'MANUAL', AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }] },
      select: { amount: true },
    });
    const manualTotal = manual.reduce((s, m) => s + toNumber(m.amount), 0);

    const totalSales = marketplaceSales + manualTotal;
    const commissionInfo = calculateCumulativeCommission(totalSales || 0);
    const marketplaceCommission = Number(commissionInfo.commission || 0);

    if (marketplaceCommission === 0 && totalSales === 0) {
      console.log('No marketplace sales/commission for period; nothing to upsert');
      return;
    }

    // Upsert ledger: attach marketing detail with marketplace totals/commission
    const existing = await prisma.commissionLedger.findUnique({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } },
    });

    const existingDetail = existing && typeof existing.detail === 'object' ? existing.detail : {};
    const previousMarketplace = existingDetail.marketing ?? null;
    const previousMarketplaceCommission = toNumber(previousMarketplace?.commission);

    const grossBeforeMarketplace = Math.max(0, toNumber(existing?.grossCommission) - previousMarketplaceCommission);
    const grossCommission = grossBeforeMarketplace + marketplaceCommission;
    const penalties = toNumber(existing?.penalties);
    const netCommission = grossCommission - penalties;

    const nextDetail = { ...existingDetail, marketing: { periodKey: period.key, totals: { totalSales }, commission: marketplaceCommission, computedAt: new Date().toISOString() } };

    const ledger = await prisma.commissionLedger.upsert({
      where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.start, periodEnd: period.end } },
      update: {
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: (Number(existing?.commissionTotal ?? 0) - previousMarketplaceCommission + marketplaceCommission).toFixed(2),
        detail: nextDetail,
      },
      create: {
        userId: user.id,
        periodStart: period.start,
        periodEnd: period.end,
        grossCommission: grossCommission.toFixed(2),
        netCommission: netCommission.toFixed(2),
        commissionTotal: marketplaceCommission.toFixed(2),
        detail: nextDetail,
      },
    });

    console.log('Upserted ledger:', { ledgerId: ledger.id, totalSales, marketplaceCommission });
  } catch (e) {
    console.error('Failed to recompute marketplace ledger:', e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
