"use strict";
var _a;
// Simple PM2-friendly worker that periodically syncs Jumia pending orders into the DB
require('dotenv/config');
// Use CommonJS require to avoid Node ESM resolution issues under ts-node
const { syncAllAccountsPendingOrders } = require('../src/lib/jumia/syncPendingOrders');
const INTERVAL_MS = Number((_a = process.env.JUMIA_WORKER_INTERVAL_MS) !== null && _a !== void 0 ? _a : 15000);
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function tick() {
    const startedAt = new Date();
    try {
        const results = (await syncAllAccountsPendingOrders());
        const totalOrders = results.reduce((acc, r) => acc + ((r === null || r === void 0 ? void 0 : r.orders) || 0), 0);
        const totalPages = results.reduce((acc, r) => acc + ((r === null || r === void 0 ? void 0 : r.pages) || 0), 0);
        // eslint-disable-next-line no-console
        console.log(`[jumia-sync-worker] tick ok @ ${startedAt.toISOString()} pages=${totalPages} orders=${totalOrders} shops=${results.length}`);
    }
    catch (err) {
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
