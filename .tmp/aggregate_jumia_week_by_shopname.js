const { PrismaClient, Platform } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArg(idx, def) { return process.argv[idx] || def; }
function norm(s){ return (s||'').trim().toLowerCase(); }

(async () => {
  try {
    const startArg = parseArg(2, '2025-12-29');
    const endArg = parseArg(3, '2026-01-04');
    const start = new Date(startArg + 'T00:00:00');
    const end = new Date(endArg + 'T23:59:59.999');
    console.log('Period:', startArg, '->', endArg);

    const accounts = await prisma.marketplaceAccount.findMany({ where: { platform: Platform.JUMIA } });
    const map = new Map();
    for (const acct of accounts) {
      const rows = await prisma.marketplacePayoutWeek.findMany({ where: { accountId: acct.id, AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] } });
      const sum = rows.reduce((s,r)=>s+Number(r.payoutAmount??0),0);
      const key = norm(acct.displayName || acct.id);
      const entry = map.get(key) || { name: acct.displayName || acct.id, sum: 0, rows: 0 };
      entry.sum += sum;
      entry.rows += rows.length;
      map.set(key, entry);
    }

    const sorted = Array.from(map.values()).sort((a,b)=>b.sum - a.sum);
    for (const e of sorted) {
      console.log(`${e.name} -> ${e.sum.toFixed(2)} (${e.rows} stmt rows)`);
    }
    const total = sorted.reduce((s,e)=>s+e.sum,0);
    console.log('Total:', total.toFixed(2));
    console.log('Done');
  } catch (err) {
    console.error('failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
