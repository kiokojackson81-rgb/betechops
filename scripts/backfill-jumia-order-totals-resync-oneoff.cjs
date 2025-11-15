// One-off deep incremental sync to populate cached totals fields for historical JumiaOrder rows.
// Usage (PowerShell):
//   $Env:JUMIA_SYNC_LOOKBACK_DAYS=365; node scripts/backfill-jumia-order-totals-resync-oneoff.cjs
// Optionally restrict lookback via LOOKBACK_DAYS env; defaults to JUMIA_SYNC_LOOKBACK_DAYS or 365.
require('dotenv/config');
// Register path aliases for compiled worker code expecting @/*
try {
  const tsconfigPaths = require('tsconfig-paths');
  const path = require('path');
  tsconfigPaths.register({ baseUrl: path.join(__dirname, '..'), paths: { '@/*': ['src/*'] } });
} catch (e) {
  console.warn('[resync-oneoff] tsconfig-paths registration failed (non-fatal):', e && e.message);
}
const { prisma } = require('../src/lib/prisma.ts');
const { syncOrdersIncremental } = require('../.worker-dist/src/lib/jobs/jumia.js');

async function main() {
  const lookback = Number(process.env.LOOKBACK_DAYS || process.env.JUMIA_SYNC_LOOKBACK_DAYS || 365);
  console.log('[resync-oneoff] starting deep incremental lookbackDays=' + lookback);
  const summary = await syncOrdersIncremental({ lookbackDays: lookback });
  console.log('[resync-oneoff] summary', summary);
  const missing = await prisma.jumiaOrder.count({ where: { OR: [ { totalAmountLocalValue: null }, { totalAmountLocalCurrency: null } ] } });
  console.log('[resync-oneoff] remaining missing totals rows=' + missing);
  await prisma.$disconnect();
}

main().catch(err => { console.error('[resync-oneoff] fatal', err); process.exit(1); });