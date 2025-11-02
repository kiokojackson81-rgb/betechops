// Simple PM2-friendly worker that periodically syncs Jumia pending orders into the DB
import 'dotenv/config';
import 'tsconfig-paths/register';

import { syncAllAccountsPendingOrders } from '@/lib/jumia/syncPendingOrders';

const INTERVAL_MS = Number(process.env.JUMIA_WORKER_INTERVAL_MS ?? 15_000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick() {
  const startedAt = new Date();
  try {
    const results = await syncAllAccountsPendingOrders();
    const totalOrders = results.reduce((acc, r) => acc + (r?.orders || 0), 0);
    const totalPages = results.reduce((acc, r) => acc + (r?.pages || 0), 0);
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
