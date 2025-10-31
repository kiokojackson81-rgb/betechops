/* scripts/backfill-catalog-counters.ts
 * Backfills exact catalog counters for all Jumia shops and the aggregate row.
 */
import 'ts-node/register';
import { prisma } from '../src/lib/prisma';
import { recomputeAllCounters } from '../src/lib/catalog-counters';

async function main() {
  const start = Date.now();
  console.log('[backfill] Starting recomputeAllCounters…');
  const { aggregate } = await recomputeAllCounters();
  const rows = await prisma.catalogCounters.findMany({ orderBy: [{ scope: 'asc' }, { shopId: 'asc' }] as any });
  const spent = Math.round((Date.now() - start) / 1000);
  console.log(`[backfill] Done in ${spent}s. Rows in CatalogCounters: ${rows.length}`);
  for (const r of rows) {
    const label = r.scope === 'ALL' ? 'ALL' : r.shopId;
    console.log(` - ${r.scope}:${label} total=${r.total} active=${r.active} qcApproved=${r.qcApproved} approx=${r.approx} computedAt=${r.computedAt.toISOString()}`);
  }
  if (aggregate) {
    console.log('[backfill] Aggregate updated.');
  }
}

main()
  .catch((e) => {
    console.error('[backfill] Failed:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch {}
  });
