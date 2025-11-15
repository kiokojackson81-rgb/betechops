// One-off deep incremental sync using compiled worker code to backfill cached totals.
require('dotenv/config');
const { prisma } = require('../src/lib/prisma.js');
const { syncOrdersIncremental } = require('../src/lib/jobs/jumia.js');

async function main() {
  const lookback = Number(process.env.LOOKBACK_DAYS || process.env.JUMIA_SYNC_LOOKBACK_DAYS || 365);
  console.log('[worker-resync-oneoff] starting lookbackDays=' + lookback);
  const summary = await syncOrdersIncremental({ lookbackDays: lookback });
  console.log('[worker-resync-oneoff] summary', summary);
  const missing = await prisma.jumiaOrder.count({ where: { OR: [ { totalAmountLocalValue: null }, { totalAmountLocalCurrency: null } ] } });
  console.log('[worker-resync-oneoff] remaining missing totals rows=' + missing);
  await prisma.$disconnect();
}

main().catch(err => { console.error('[worker-resync-oneoff] fatal', err); process.exit(1); });