// One-shot runner to trigger Jumia pending orders + marketplace sync once.
// Use `node -r ts-node/register scripts/one-shot-jumia-sync.ts` to run.
try { await import('dotenv/config'); } catch {}

async function main() {
  try {
    const pendingMod = await import('../src/lib/jumia/syncPendingOrders.ts');
    const jobsMod = await import('../src/lib/jobs/onlineSync.ts');
    const syncAllAccountsPendingOrders = pendingMod.syncAllAccountsPendingOrders;
    const syncOnlineMarketplaceData = jobsMod.syncOnlineMarketplaceData;

    console.log('[one-shot-jumia-sync] starting pending-orders sync...');
    const pending = await syncAllAccountsPendingOrders();
    console.log('[one-shot-jumia-sync] pending result:', JSON.stringify(pending, null, 2));

    console.log('[one-shot-jumia-sync] starting marketplace delivered-items sync...');
    const market = await syncOnlineMarketplaceData({ lookbackDays: Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 30) });
    console.log('[one-shot-jumia-sync] marketplace result:', JSON.stringify(market, null, 2));

    console.log('[one-shot-jumia-sync] done');
    process.exit(0);
  } catch (err) {
    console.error('[one-shot-jumia-sync] failed', err);
    process.exit(2);
  }
}

void main();

export {};
