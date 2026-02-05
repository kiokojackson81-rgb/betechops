// scripts/compute-jumia-cards.js
try { require('dotenv/config'); } catch {}

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseList(arg) {
  if (!arg) return [];
  return arg.split(',').map(s => s.trim()).filter(Boolean);
}

async function compute(weekStart, shopSid, accountIds) {
  const whereDate = new Date(weekStart + 'T00:00:00Z');
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { weekStart: whereDate } });

  const map = new Map();
  for (const r of rows) {
    const stmt = r.statementNumber || (`AUTO:${r.accountId}:${r.weekStart.toISOString().slice(0,10)}`);
    if (!stmt.startsWith('PS')) continue;
    const shop = r.rawPayload && r.rawPayload.shopSid;
    if (shopSid && String(shop) !== String(shopSid)) continue;
    if (accountIds && accountIds.length && !accountIds.includes(r.accountId)) continue;
    const key = `${stmt}::${shop || ''}`;
    const cur = map.get(key) || { stmt, shop, sum: 0 };
    cur.sum += Number(r.payoutAmount || 0);
    map.set(key, cur);
  }

  const details = Array.from(map.values()).sort((a,b) => b.sum - a.sum);
  let total = details.reduce((s,d) => s + d.sum, 0);

  console.log('[compute] Per-statement sums:');
  for (const d of details) console.log(`- ${d.stmt} => ${d.sum.toFixed(2)} (${d.shop || ''})`);
  console.log('[compute] Card total (PS statements only) =', total.toFixed(2));
}

async function main() {
  const wkArg = process.argv.find(a => a.startsWith('--weekStart='));
  if (!wkArg) { console.error('Usage: node scripts/compute-jumia-cards.js --weekStart=YYYY-MM-DD [--shopSid=...] [--noSync] [--lookbackDays=N]'); process.exit(2); }
  const weekStart = wkArg.split('=')[1];
  const shopSid = (process.argv.find(a => a.startsWith('--shopSid=')) || '').split('=')[1] || null;
  const noSync = !!process.argv.find(a => a === '--noSync');
  const lookback = (process.argv.find(a => a.startsWith('--lookbackDays=')) || '').split('=')[1] || '7';

  if (!noSync) {
    console.log('[compute] running quick marketplace sync (dist runner) with lookbackDays=' + lookback);
    try { execSync(`node scripts/run-jumia-one-shot-dist.js --lookbackDays=${lookback}`, { stdio: 'inherit', env: process.env }); }
    catch (err) { console.error('[compute] sync failed (continuing):', err && err.message ? err.message : err); }
  }

  await compute(weekStart, shopSid, []);
  await prisma.$disconnect();
}

main().catch(err => { console.error('[compute] failed', err); prisma.$disconnect().finally(() => process.exit(2)); });
