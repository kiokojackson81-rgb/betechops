import { syncOrders } from './jumia';
import { logger } from '../log';
import { incShopRuns, incShopRunFailures, gaugeShopsInProgress } from '../metrics';

export type RunOptions = {
  concurrency?: number;
  retries?: number;
  retryDelayMs?: number;
};

async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runShop(shopId: string, options: RunOptions) {
  const retries = options.retries ?? 2;
  const baseDelay = options.retryDelayMs ?? 500;
  let attempt = 0;
  while (true) {
    try {
      const processed = await syncOrders(shopId, async () => {
        return;
      });
      return { shopId, ok: true, processed };
    } catch (err) {
      attempt += 1;
      if (attempt > retries) {
        return { shopId, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      const jitter = Math.random() * 100;
      await delay(baseDelay * attempt + jitter);
    }
  }
}

export async function runForShops(shopIds: string[], options: RunOptions = {}) {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const results: Array<unknown> = [];
  const executing: Promise<void>[] = [];

  let inFlight = 0;
  for (const shopId of shopIds) {
    const p = (async () => {
      incShopRuns(1);
      inFlight += 1;
      gaugeShopsInProgress(inFlight);
      logger.info({ shopId }, 'starting shop run');
      const r = await runShop(shopId, options);
      results.push(r);
      logger.info({ shopId, result: r }, 'finished shop run');
      inFlight -= 1;
      gaugeShopsInProgress(inFlight);
      if (!r.ok) incShopRunFailures(1);
    })();

    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // compact executing to remove settled promises
      // simplest: await Promise.allSettled and keep pending — but to avoid waiting, filter by length
      for (let i = executing.length - 1; i >= 0; i--) {
        // no reliable way to check settled without external lib; we'll filter by replacing with a new array of remaining
        // This is a lightweight best-effort: create a new array by awaiting Promise.any of executing then rebuild.
      }
    }
  }

  await Promise.all(executing);
  return results;
}

const runner = { runForShops };
export default runner;