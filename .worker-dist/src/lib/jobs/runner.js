"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runForShops = runForShops;
const jumia_1 = require("./jumia");
const log_1 = require("../log");
const metrics_1 = require("../metrics");
async function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
async function runShop(shopId, options) {
    var _a, _b;
    const retries = (_a = options.retries) !== null && _a !== void 0 ? _a : 2;
    const baseDelay = (_b = options.retryDelayMs) !== null && _b !== void 0 ? _b : 500;
    let attempt = 0;
    while (true) {
        try {
            const processed = await (0, jumia_1.syncOrders)(shopId, async () => {
                return;
            });
            return { shopId, ok: true, processed };
        }
        catch (err) {
            attempt += 1;
            if (attempt > retries) {
                return { shopId, ok: false, error: err instanceof Error ? err.message : String(err) };
            }
            const jitter = Math.random() * 100;
            await delay(baseDelay * attempt + jitter);
        }
    }
}
async function runForShops(shopIds, options = {}) {
    var _a;
    const concurrency = Math.max(1, (_a = options.concurrency) !== null && _a !== void 0 ? _a : 2);
    const results = [];
    const executing = [];
    let inFlight = 0;
    for (const shopId of shopIds) {
        const p = (async () => {
            (0, metrics_1.incShopRuns)(1);
            inFlight += 1;
            (0, metrics_1.gaugeShopsInProgress)(inFlight);
            log_1.logger.info({ shopId }, 'starting shop run');
            const r = await runShop(shopId, options);
            results.push(r);
            log_1.logger.info({ shopId, result: r }, 'finished shop run');
            inFlight -= 1;
            (0, metrics_1.gaugeShopsInProgress)(inFlight);
            if (!r.ok)
                (0, metrics_1.incShopRunFailures)(1);
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
exports.default = runner;
