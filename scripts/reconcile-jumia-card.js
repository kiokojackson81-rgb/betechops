// scripts/reconcile-jumia-card.js
try { require('dotenv/config'); } catch {}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseList(arg) {
  if (!arg) return [];
  return arg.split(',').map(s => s.trim()).filter(Boolean);
}

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    try { return parseFloat(String(v)); } catch { return 0; }
  }
  return n;
}

async function main() {
  const wkArg = process.argv.find(a => a.startsWith('--weekStart='));
  if (!wkArg) {
    console.error('Usage: node scripts/reconcile-jumia-card.js --weekStart=YYYY-MM-DD [--shopSids=sid1,sid2] [--accountIds=id1,id2]');
    process.exit(2);
  }
  const weekStart = wkArg.split('=')[1];
  const shopSids = parseList((process.argv.find(a => a.startsWith('--shopSids=')) || '').split('=')[1]);
  const accountIds = parseList((process.argv.find(a => a.startsWith('--accountIds=')) || '').split('=')[1]);

  const where = { weekStart: new Date(weekStart + 'T00:00:00Z') };
  const rows = await prisma.marketplacePayoutWeek.findMany({ where });
  if (!rows || rows.length === 0) {
    console.log('[reconcile] no rows for week', weekStart);
    process.exit(0);
  }

  const filtered = rows.filter(r => {
    if (shopSids.length) {
      const sid = r.rawPayload && r.rawPayload.shopSid;
      return shopSids.includes(sid);
    }
    if (accountIds.length) {
      return accountIds.includes(r.accountId);
    }
    return true;
  });

  const byStmt = new Map();
  for (const r of filtered) {
    const stmt = r.statementNumber || (`AUTO:${r.accountId}:${r.weekStart.toISOString().slice(0,10)}`);
    const cur = byStmt.get(stmt) || { statement: stmt, rows: [], sum: 0 };
    cur.rows.push({ accountId: r.accountId, payout: toNumber(r.payoutAmount), paid: !!r.isPaid, currency: r.currency });
    cur.sum += toNumber(r.payoutAmount);
    byStmt.set(stmt, cur);
  }

  let dbPSsum = 0;
  let dbAllSum = 0;
  const details = [];
  for (const [stmt, info] of byStmt.entries()) {
    dbAllSum += info.sum;
    if (stmt.startsWith('PS')) dbPSsum += info.sum;
    details.push({ statement: stmt, sum: info.sum, rows: info.rows });
  }

  console.log('[reconcile] week:', weekStart);
  console.log('[reconcile] total statements:', details.length);
  console.log('[reconcile] db sum (all statements):', dbAllSum.toFixed(2));
  console.log('[reconcile] db sum (PS statements only):', dbPSsum.toFixed(2));

  console.log('\nPer-statement breakdown:');
  details.sort((a,b) => b.sum - a.sum).forEach(d => {
    console.log(`- ${d.statement} => ${d.sum.toFixed(2)} (${d.rows.length} rows)`);
    d.rows.forEach(r => console.log(`    - acct=${r.accountId} payout=${r.payout.toFixed(2)} paid=${r.paid} ${r.currency || ''}`));
  });

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[reconcile] failed', err);
  prisma.$disconnect().finally(() => process.exit(2));
});
