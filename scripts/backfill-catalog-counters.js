// scripts/backfill-catalog-counters.js
// Backfills exact catalog counters for all shops using library functions.
require('ts-node/register');
require('tsconfig-paths/register');

async function run() {
  const { prisma } = require('../src/lib/prisma');
  const lib = require('../src/lib/catalog-counters');
  const start = Date.now();
  console.log('[backfill] Starting recomputeAllCounters…');
  const res = await lib.recomputeAllCounters();
  const rows = await prisma.catalogCounters.findMany({ orderBy: [{ scope: 'asc' }, { shopId: 'asc' }] });
  const spent = Math.round((Date.now() - start) / 1000);
  console.log(`[backfill] Done in ${spent}s. Rows in CatalogCounters: ${rows.length}`);
  for (const r of rows) {
    const label = r.scope === 'ALL' ? 'ALL' : r.shopId;
    console.log(` - ${r.scope}:${label} total=${r.total} active=${r.active} qcApproved=${r.qcApproved} approx=${r.approx} computedAt=${new Date(r.computedAt).toISOString()}`);
  }
  if (res && res.aggregate) console.log('[backfill] Aggregate updated.');
}

run().catch((e) => { console.error('[backfill] Failed:', e?.message || e); process.exit(1); });
