// scripts/refresh-jumia-cards.js
try { require('dotenv/config'); } catch {}

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseList(arg) {
  if (!arg) return [];
  return arg.split(',').map(s => s.trim()).filter(Boolean);
}

async function compute(weekStart, shopSid, accountIds) {
  // Query only vendor PS statements
  const whereDate = new Date(weekStart + 'T00:00:00Z');
  const rows = await prisma.$queryRaw`
    SELECT (raw_payload->>'statementNumber') AS stmt, SUM(payout_amount)::numeric(18,2) AS amount, (raw_payload->>'shopSid') AS shopSid
    FROM marketplace_payout_week
    WHERE week_start = ${whereDate}
      AND (raw_payload->>'statementNumber') LIKE 'PS%'
    GROUP BY (raw_payload->>'statementNumber'), (raw_payload->>'shopSid')
    ORDER BY amount DESC
  `;

  // filter by shopSid/accountIds if provided
  const filtered = rows.filter(r => {
    if (shopSid) return String(r.shopSid) === String(shopSid);
    if (accountIds && accountIds.length) return accountIds.includes(r.accountid);
    return true;
  });

  let total = 0;
  console.log('[refresh] Per-statement sums:');
  for (const r of filtered) {
    const amt = Number(r.amount || 0);
    total += amt;
    console.log(`- ${r.stmt} => ${amt.toFixed(2)} (${r.shopSid || ''})`);
  }
  console.log('[refresh] Card total (PS statements only) =', total.toFixed(2));
}

async function main() {
  const wkArg = process.argv.find(a => a.startsWith('--weekStart='));
  if (!wkArg) {
    console.error('Usage: node scripts/refresh-jumia-cards.js --weekStart=YYYY-MM-DD [--shopSid=...] [--accountIds=id1,id2] [--noSync] [--lookbackDays=N]');
    process.exit(2);
  }
  const weekStart = wkArg.split('=')[1];
  const shopSid = (process.argv.find(a => a.startsWith('--shopSid=')) || '').split('=')[1] || null;
  const accountIds = parseList((process.argv.find(a => a.startsWith('--accountIds=')) || '').split('=')[1]);
  const noSync = !!process.argv.find(a => a === '--noSync');
  const lookback = (process.argv.find(a => a.startsWith('--lookbackDays=')) || '').split('=')[1] || '7';

  if (!noSync) {
    console.log('[refresh] running quick marketplace sync (dist runner) with lookbackDays=' + lookback);
    try {
      execSync(`node scripts/run-jumia-one-shot-dist.js --lookbackDays=${lookback}`, { stdio: 'inherit', env: process.env });
    } catch (err) {
      console.error('[refresh] sync failed (continuing to compute from DB):', err && err.message ? err.message : err);
    }
  }

  await compute(weekStart, shopSid, accountIds);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[refresh] failed', err);
  prisma.$disconnect().finally(() => process.exit(2));
});
