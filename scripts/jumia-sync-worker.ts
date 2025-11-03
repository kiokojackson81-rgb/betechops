// Simple PM2-friendly worker that periodically pulls Jumia orders into the DB.
// We now run two passes:
//   1. Pending-orders window sync (fast, only the 7-day pending slice).
//   2. Full incremental sync across all downstream statuses so local rows
//      leave PENDING as soon as the vendor updates them.
// Load .env if present but don't hard-require it (PM2 usually provides env)
try { require('dotenv/config'); } catch { /* optional */ }
// Ensure path aliases (@/*) resolve in the compiled CJS bundle by mapping to .worker-dist/src/*
try {
  const tsconfigPaths = require('tsconfig-paths');
  const path = require('path');
  tsconfigPaths.register({
    baseUrl: path.join(__dirname, '..'), // points to .worker-dist
    paths: { '@/*': ['src/*'] },
  });
} catch { /* optional */ }
// Use CommonJS require to avoid Node ESM resolution issues under ts-node
const { syncAllAccountsPendingOrders } = require('../src/lib/jumia/syncPendingOrders');
const { syncOrdersIncremental } = require('../src/lib/jobs/jumia');

// Default to 5s; can be overridden via env JUMIA_WORKER_INTERVAL_MS
const INTERVAL_MS = Number(process.env.JUMIA_WORKER_INTERVAL_MS ?? 5_000);
// Allow tuning for environments that prefer a slower incremental cadence,
// but default to matching the tick interval so vendor/order state mirrors quickly.
const INCREMENTAL_EVERY_MS = Number(process.env.JUMIA_WORKER_INCREMENTAL_EVERY_MS ?? INTERVAL_MS);
// Optional: run the heavy pending sweep less often than the tick to reduce vendor load
const PENDING_EVERY_MS = Number(process.env.JUMIA_WORKER_PENDING_EVERY_MS ?? INTERVAL_MS);

const LOG_PREFIX = '[jumia-sync-worker]';
let lastIncrementalAt = 0;
let lastPendingAt = 0;
let inFlight = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick() {
  if (inFlight) {
    // eslint-disable-next-line no-console
    console.warn(`${LOG_PREFIX} previous tick still in-flight; skipping this interval`);
    return;
  }
  inFlight = true;
  const startedAt = new Date();
  const logParts: string[] = [];
  let anyWork = false;

  const now = Date.now();
  if (now - lastPendingAt >= PENDING_EVERY_MS) {
    try {
      const results = (await syncAllAccountsPendingOrders()) as any[];
      const totalOrders = results.reduce((acc: number, r: any) => acc + (r?.orders || 0), 0);
      const totalPages = results.reduce((acc: number, r: any) => acc + (r?.pages || 0), 0);
      logParts.push(`pending pages=${totalPages} orders=${totalOrders} shops=${results.length}`);
      lastPendingAt = now;
      anyWork = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} pending sync failed`, err);
    }
  }

  if (now - lastIncrementalAt >= INCREMENTAL_EVERY_MS) {
    try {
      const summary = (await syncOrdersIncremental()) as Record<string, { processed: number; upserted: number; cursor?: string }>;
      const shopSummaries = Object.values(summary || {});
      const incProcessed = shopSummaries.reduce((acc, s) => acc + (s?.processed || 0), 0);
      const incUpserted = shopSummaries.reduce((acc, s) => acc + (s?.upserted || 0), 0);
      logParts.push(`incremental processed=${incProcessed} upserted=${incUpserted} shops=${shopSummaries.length}`);
      lastIncrementalAt = now;
      anyWork = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} incremental sync failed`, err);
    }
  }

  if (anyWork && logParts.length) {
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} tick ok @ ${startedAt.toISOString()} interval=${INTERVAL_MS}ms details: ${logParts.join(' | ')}`);
  }
  inFlight = false;
}

(async () => {
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} starting, interval(ms)= ${INTERVAL_MS}, incrementalEvery(ms)= ${INCREMENTAL_EVERY_MS}, pendingEvery(ms)= ${PENDING_EVERY_MS}`);
  // initial tick immediately
  await tick();
  while (true) {
    await sleep(INTERVAL_MS);
    await tick();
  }
})();

export {}; // mark this file as a module to avoid global script scope collisions
