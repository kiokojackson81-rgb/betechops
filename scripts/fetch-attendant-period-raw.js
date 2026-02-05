const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

(async () => {
  const email = process.argv[2] || 'brendah@betech.co.ke';
  const startArg = process.argv[3];
  const endArg = process.argv[4];

  let start = parseDate(startArg);
  let end = parseDate(endArg);

  if (!start || !end) {
    console.error('Usage: node scripts/fetch-attendant-period-raw.js <email> <startISO> <endISO>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true } });
    if (!user) return console.error('User not found:', email);

    // Find ledger for exact period
    const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: start, periodEnd: end } } });

    // Sum profit snapshots as fallback for sales/profit
    const snapshots = await prisma.profitSnapshot.findMany({
      where: {
        orderItem: {
          order: {
            attendantId: user.id,
            createdAt: { gte: start, lte: end },
          },
        },
      },
      select: { revenue: true, profit: true },
    });

    let totalSales = 0;
    let totalProfit = 0;
    for (const s of snapshots) {
      totalSales += Number(s.revenue ?? 0);
      totalProfit += Number(s.profit ?? 0);
    }

    // Get support/marketing aggregates if present in ledger.detail
    const detail = ledger ? ledger.detail : null;

    const summary = {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      period: { start: start.toISOString(), end: end.toISOString() },
      totals: { totalSales, totalProfit },
      ledger: ledger
        ? {
            id: ledger.id,
            commissionTotal: ledger.commissionTotal,
            grossCommission: ledger.grossCommission,
            netCommission: ledger.netCommission,
            detail,
            createdAt: ledger.createdAt,
          }
        : null,
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
