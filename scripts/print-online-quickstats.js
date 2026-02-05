const { PrismaClient } = require("@prisma/client");

function getTradingPeriodFor(date = new Date()) {
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

async function main() {
  const email = process.env.USER_EMAIL || process.argv[2] || "stephen@betech.co.ke";
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error("User not found:", email);
      process.exitCode = 2;
      return;
    }

    const period = getTradingPeriodFor(new Date());
    console.log("Period:", period.start.toISOString(), "->", period.end.toISOString());

    const assignments = await prisma.marketplaceAccountAssignment.findMany({
      where: {
        attendantId: user.id,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });
    const accountIds = assignments.map((a) => a.accountId);

    let payoutSales = 0;
    if (accountIds.length) {
      const rows = await prisma.marketplacePayoutWeek.findMany({
        where: { AND: [{ weekStart: { lte: period.end } }, { weekEnd: { gte: period.start } }, { accountId: { in: accountIds } }] },
      });
      // aggregate by accountId + weekStart/weekEnd to dedupe slightly-offset rows
      const map = new Map();
      for (const r of rows) {
        const key = `${r.accountId}::${new Date(r.weekStart).toISOString()}::${new Date(r.weekEnd).toISOString()}`;
        const val = Number(r.grossSales ?? r.payoutAmount ?? 0);
        map.set(key, (map.get(key) || 0) + val);
      }
      payoutSales = Array.from(map.values()).reduce((s, v) => s + v, 0);
    }

    const weeklyManual = await prisma.weeklySale.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: {
        userId: user.id,
        status: "APPROVED",
        AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
      },
    });
    const weeklyManualSales = Number(weeklyManual._sum?.amount ?? 0);

    const directEntries = await prisma.supportDailyEntry.findMany({
      where: { submittedById: user.id, date: { gte: period.start, lte: period.end } },
      select: { totalSales: true, receipts: { select: { id: true } } },
    });
    const directSales = directEntries.reduce((s, e) => s + Number(e.totalSales ?? 0), 0);
    const receiptsCount = directEntries.reduce((c, e) => c + (e.receipts?.length || 0), 0);

    const marketplaceSales = payoutSales + weeklyManualSales;
    const totalTrackedSales = directSales + marketplaceSales;

    const PROGRESS_TARGET = 2_000_000;
    const remainingToNextTier = Math.max(0, PROGRESS_TARGET - totalTrackedSales);

    console.log("directSales:", directSales);
    console.log("payoutSales:", payoutSales);
    console.log("weeklyManualSales:", weeklyManualSales);
    console.log("marketplaceSales:", marketplaceSales);
    console.log("totalTrackedSales:", totalTrackedSales);
    console.log("progressTarget:", PROGRESS_TARGET);
    console.log("remainingToNextTier:", remainingToNextTier);
    console.log("receiptsCount:", receiptsCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (_) {}
  }
}

main();
