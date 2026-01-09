// scripts/run-jumia-one-shot-dist.js
try { require('dotenv/config'); } catch {}

const pendingMod = require('../.worker-dist/src/lib/jumia/syncPendingOrders');
const jobsMod = require('../.worker-dist/src/lib/jobs/onlineSync');

async function main() {
  try {
      function maskCreds(url) {
        if (!url || typeof url !== 'string') return url;
        const protoIndex = url.indexOf('://');
        if (protoIndex === -1) return url;
        const atIndex = url.indexOf('@', protoIndex + 3);
        if (atIndex === -1) return url;
        return url.slice(0, protoIndex + 3) + '***:***' + url.slice(atIndex);
      }

      if (process.env.DATABASE_URL) {
        console.log('[run-jumia-one-shot-dist] DB:', maskCreds(process.env.DATABASE_URL));
      }
      if (process.env.DIRECT_URL) {
        console.log('[run-jumia-one-shot-dist] DIRECT_URL:', maskCreds(process.env.DIRECT_URL));
      }
    const lookbackArg = process.argv.find((arg) => arg.startsWith('--lookbackDays='));
    const lookbackDays = lookbackArg
      ? Number.parseInt(lookbackArg.split('=')[1], 10)
      : Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 90);
    if (Number.isNaN(lookbackDays)) {
      throw new Error('--lookbackDays must be a number');
    }
    console.log('[run-jumia-one-shot-dist] starting pending-orders sync...');
    const pending = await pendingMod.syncAllAccountsPendingOrders();
    console.log('[run-jumia-one-shot-dist] pending result:', JSON.stringify(pending, null, 2));

    console.log('[run-jumia-one-shot-dist] starting marketplace delivered-items sync...');
    const market = await jobsMod.syncOnlineMarketplaceData({ lookbackDays });
    console.log('[run-jumia-one-shot-dist] marketplace result:', JSON.stringify(market, null, 2));

    console.log('[run-jumia-one-shot-dist] done');
    process.exit(0);
  } catch (err) {
    console.error('[run-jumia-one-shot-dist] failed', err);
    process.exit(2);
  }
}

void main();

module.exports = {};
