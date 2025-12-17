const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const client = new PrismaClient();

function getPreviousWeekRange(reference = new Date()) {
  const now = new Date(reference);
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1; // Monday = 1
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - diffToMonday);
  thisWeekStart.setHours(0, 0, 0, 0);
  // previous week start = thisWeekStart - 7 days
  const prevStart = new Date(thisWeekStart);
  prevStart.setDate(thisWeekStart.getDate() - 7);
  const prevEnd = new Date(prevStart);
  prevEnd.setDate(prevStart.getDate() + 6);
  prevEnd.setHours(23, 59, 59, 999);
  return { start: prevStart, end: prevEnd };
}

async function run() {
  const { start, end } = getPreviousWeekRange();
  console.log('Reconciliation range:', start.toISOString(), '->', end.toISOString());

  // orders grouped by account
  const orderGroups = await client.marketplaceOrder.groupBy({
    by: ['accountId'],
    where: { orderedAt: { gte: start, lte: end } },
    _sum: { sellingPrice: true, profit: true },
    _count: { _all: true },
  });

  // weekly sales approved/manual in range
  const weeklySales = await client.weeklySale.findMany({
    where: {
      AND: [{ weekEnd: { gte: start } }, { weekStart: { lte: end } }],
      status: 'APPROVED',
    },
    include: { shop: { select: { id: true, name: true, platform: true, apiConfig: { select: { apiKey: true } } } } },
  });

  // commission ledger entries overlapping period
  // Use raw SQL to avoid Prisma P2022 errors when the DB schema is out-of-sync
  // with the generated Prisma client. Query information_schema for available
  // columns and then select only those columns.
  const colsRes = await client.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name ILIKE '%commission%' OR (table_name ILIKE '%commission_ledger%' AND table_schema='public')`,
  );
  // Fallback: attempt to select commonly used fields if the above returns nothing
  let ledgerCols = [];
  try {
    ledgerCols = colsRes && Array.isArray(colsRes) ? colsRes.map((r) => r.column_name) : [];
  } catch (e) {
    ledgerCols = [];
  }

  // If no commission-looking columns discovered, try to inspect the table directly
  if (!ledgerCols.length) {
    const fallback = await client.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name ILIKE 'commission%';`,
    );
    ledgerCols = Array.isArray(fallback) ? fallback.map((r) => r.column_name) : [];
  }

  // Choose a safe set of columns to select (always include id, userId, periodStart, periodEnd if present)
  const wanted = ['id', 'userId', 'periodStart', 'periodEnd', 'grossCommission', 'netCommission', 'penalties', 'detail'];
  const available = ledgerCols.filter((c) => wanted.includes(c));
  const selectCols = available.length ? available : ['id', 'userId', 'periodStart', 'periodEnd'];

  const colList = selectCols.map((c) => `"${c}"`).join(', ');
  const ledgersSql = `SELECT ${colList} FROM "CommissionLedger" WHERE "periodStart" <= $1::timestamp AND "periodEnd" >= $2::timestamp LIMIT 200`;
  const ledgers = await client.$queryRawUnsafe(ledgersSql, end.toISOString(), start.toISOString());

  // marketplace accounts
  const accounts = await client.marketplaceAccount.findMany({ select: { id: true, displayName: true, platform: true, jumiaShopSid: true, kilimallShopCode: true } });
  const accountMap = {};
  accounts.forEach(a => (accountMap[a.id] = a));

  const orders = orderGroups.map(g => ({ accountId: g.accountId, orders: g._count._all, sellingPriceSum: Number(g._sum.sellingPrice ?? 0), profitSum: Number(g._sum.profit ?? 0), account: accountMap[g.accountId] ?? null }));

  const report = {
    range: { start: start.toISOString(), end: end.toISOString() },
    generatedAt: new Date().toISOString(),
    orders,
    weeklySales: weeklySales.map(w => ({ id: w.id, shopId: w.shopId, shopName: w.shop?.name ?? null, platform: w.platform, amount: Number(w.amount ?? 0), source: w.source, status: w.status, weekStart: w.weekStart, weekEnd: w.weekEnd })),
    ledgers: ledgers.map(l => ({ id: l.id, userId: l.userId, periodStart: l.periodStart, periodEnd: l.periodEnd, grossCommission: Number(l.grossCommission ?? 0), netCommission: Number(l.netCommission ?? 0), penalties: Number(l.penalties ?? 0), detail: l.detail })),
  };

  const outDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = path.join(outDir, `reconcile_online_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote report to', filename);

  await client.$disconnect();
}

run().catch(async (err) => {
  console.error('Error running reconcile script', err);
  try { await client.$disconnect(); } catch(e){}
  process.exit(1);
});
