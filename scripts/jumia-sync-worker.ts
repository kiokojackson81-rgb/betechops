// Simple PM2-friendly worker that periodically syncs Jumia pending orders into the DB
// Load .env if present but don't hard-require it (PM2 usually provides env)
try { require('dotenv/config'); } catch { /* optional */ }
// Use CommonJS require to avoid Node ESM resolution issues under ts-node
const { syncAllAccountsPendingOrders } = require('../src/lib/jumia/syncPendingOrders');

// Default to 5s; can be overridden via env JUMIA_WORKER_INTERVAL_MS
const INTERVAL_MS = Number(process.env.JUMIA_WORKER_INTERVAL_MS ?? 5_000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick() {
  const startedAt = new Date();
  try {
    const results = (await syncAllAccountsPendingOrders()) as any[];
    const totalOrders = results.reduce((acc: number, r: any) => acc + (r?.orders || 0), 0);
    const totalPages = results.reduce((acc: number, r: any) => acc + (r?.pages || 0), 0);
    // eslint-disable-next-line no-console
    console.log(
      `[jumia-sync-worker] tick ok @ ${startedAt.toISOString()} pages=${totalPages} orders=${totalOrders} shops=${results.length}`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[jumia-sync-worker] tick failed', err);
  }
}

(async () => {
  // eslint-disable-next-line no-console
  console.log('[jumia-sync-worker] starting, interval(ms)=', INTERVAL_MS);
  // initial tick immediately
  await tick();
  while (true) {
    await sleep(INTERVAL_MS);
    await tick();
  }
})();
