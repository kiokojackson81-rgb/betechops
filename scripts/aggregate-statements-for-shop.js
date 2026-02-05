// scripts/aggregate-statements-for-shop.js
try { require('dotenv/config'); } catch {}
const { prisma } = require('../.worker-dist/src/lib/prisma');

async function main() {
  try {
    const argSid = process.argv.find(a => a.startsWith('--jumiaShopSid='))?.split('=')[1];
    const argAccount = process.argv.find(a => a.startsWith('--accountId='))?.split('=')[1];
    let sid = argSid;
    if (!sid && argAccount) {
      const acct = await prisma.marketplaceAccount.findUnique({ where: { id: argAccount }, select: { jumiaShopSid: true } });
      if (!acct) {
        console.error('[agg] account not found', argAccount);
        process.exit(2);
      }
      sid = acct.jumiaShopSid;
    }
    if (!sid) {
      console.error('Usage: node scripts/aggregate-statements-for-shop.js --jumiaShopSid=<sid> | --accountId=<id>');
      process.exit(2);
    }
    console.log('[agg] target jumiaShopSid=', sid);

    const accounts = await prisma.marketplaceAccount.findMany({ where: { jumiaShopSid: sid }, select: { id: true, displayName: true } });
    const accountIds = accounts.map(a => a.id);
    console.log('[agg] accounts mapped to sid:', accounts.map(a => ({ id: a.id, displayName: a.displayName })));

    // Fetch rows by accountId
    const rowsByAccount = accountIds.length ? await prisma.marketplacePayoutWeek.findMany({ where: { accountId: { in: accountIds } }, select: { id: true, accountId: true, statementNumber: true, payoutAmount: true, grossSales: true, currency: true, weekStart: true, weekEnd: true, isPaid: true, rawPayload: true } }) : [];
    // Fetch rows where rawPayload->>'shopSid' = sid
    const rowsByRaw = await prisma.$queryRaw`SELECT id, "accountId", "statementNumber", "payoutAmount", "grossSales", "currency", "weekStart", "weekEnd", "isPaid", "rawPayload" FROM "MarketplacePayoutWeek" WHERE "rawPayload"->>'shopSid' = ${sid}`;

    const combined = new Map();
    function addRow(r) {
      const id = String(r.id);
      if (combined.has(id)) return;
      combined.set(id, r);
    }
    rowsByAccount.forEach(addRow);
    rowsByRaw.forEach(addRow);

    const byStatement = new Map();
    for (const r of combined.values()) {
      const stmt = (r.statementNumber ?? (r.rawPayload && r.rawPayload.statementNumber) ?? 'UNKNOWN').toString();
      const payout = Number(r.payoutAmount ?? r.grossSales ?? 0);
      const entry = byStatement.get(stmt) || { statementNumber: stmt, totalPayout: 0, count: 0, accountIds: new Set(), weekStarts: [], weekEnds: [], anyPaid: false };
      entry.totalPayout += payout;
      entry.count += 1;
      if (r.accountId) entry.accountIds.add(r.accountId);
      if (r.weekStart) entry.weekStarts.push(new Date(r.weekStart));
      if (r.weekEnd) entry.weekEnds.push(new Date(r.weekEnd));
      if (r.isPaid) entry.anyPaid = true;
      byStatement.set(stmt, entry);
    }

    const results = Array.from(byStatement.values()).map(e => ({
      statementNumber: e.statementNumber,
      totalPayout: e.totalPayout,
      count: e.count,
      accountIds: Array.from(e.accountIds),
      weekStart: e.weekStarts.length ? new Date(Math.min(...e.weekStarts.map(d=>d.getTime()))).toISOString().slice(0,10) : null,
      weekEnd: e.weekEnds.length ? new Date(Math.max(...e.weekEnds.map(d=>d.getTime()))).toISOString().slice(0,10) : null,
      anyPaid: e.anyPaid,
    })).sort((a,b) => b.totalPayout - a.totalPayout);

    console.log('[agg] aggregated statements for shopSid=', sid);
    results.forEach(r => console.log(`- stmt=${r.statementNumber} total=${r.totalPayout.toFixed(2)} count=${r.count} accounts=${r.accountIds.join(',') || '(none)'} week=${r.weekStart}->${r.weekEnd} anyPaid=${r.anyPaid}`));

    process.exit(0);
  } catch (err) {
    console.error('[agg] failed', err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(2);
  }
}

void main();
module.exports = {};
