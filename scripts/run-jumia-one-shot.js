// scripts/run-jumia-one-shot.js
try { require('dotenv/config'); } catch {}
// Load ts-node so we can require TypeScript sources as CommonJS
require('ts-node/register');
try { require('tsconfig-paths/register'); } catch {}

const pendingMod = require('../src/lib/jumia/syncPendingOrders');
const jobsMod = require('../src/lib/jobs/onlineSync');

async function main() {
  try {
    console.log('[run-jumia-one-shot] starting pending-orders sync...');
    const pending = await pendingMod.syncAllAccountsPendingOrders();
    console.log('[run-jumia-one-shot] pending result:', JSON.stringify(pending, null, 2));

    console.log('[run-jumia-one-shot] starting marketplace delivered-items sync...');
    const market = await jobsMod.syncOnlineMarketplaceData({ lookbackDays: Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 30) });
    console.log('[run-jumia-one-shot] marketplace result:', JSON.stringify(market, null, 2));

    console.log('[run-jumia-one-shot] done');
    process.exit(0);
  } catch (err) {
    console.error('[run-jumia-one-shot] failed', err);
    process.exit(2);
  }
}

void main();

module.exports = {};
