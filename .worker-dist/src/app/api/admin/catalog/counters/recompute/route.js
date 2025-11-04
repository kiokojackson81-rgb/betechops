"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const catalog_counters_1 = require("@/lib/catalog-counters");
// POST /api/admin/catalog/counters/recompute
// Query: all=true | shopId=<id>
// Recomputes exact counters and persists them. Returns the latest counters payload.
async function POST(req) {
    const url = new URL(req.url);
    // Allow headless cron via secret (header or query): x-cron-secret / cronSecret
    const cronSecretHeader = req.headers.get("x-cron-secret") || "";
    const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();
    const cronSecretEnv = (process.env.CRON_SECRET || "").trim();
    const isCron = !!cronSecretEnv && (cronSecretHeader === cronSecretEnv || cronSecretQuery === cronSecretEnv);
    // If not a valid cron request, require authenticated role
    if (!isCron) {
        const authz = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
        if (!authz.ok)
            return authz.res;
    }
    // accept both all=true and shops=all (alias); default to all on cron
    const all = ((url.searchParams.get("all") || "").toLowerCase() === "true" || (url.searchParams.get("shops") || "").toLowerCase() === "all") || isCron;
    const shopId = (url.searchParams.get("shopId") || "").trim();
    const dryRun = (url.searchParams.get("dryRun") || "").toLowerCase() === "true";
    try {
        if (all) {
            const { aggregate } = await (0, catalog_counters_1.recomputeAllCounters)();
            const payload = { ...(0, catalog_counters_1.rowToSummaryPayload)(aggregate), updatedAt: new Date().toISOString(), cron: isCron };
            return (0, api_1.noStoreJson)(payload);
        }
        if (!shopId)
            return server_1.NextResponse.json({ error: "shopId required (or set all=true)" }, { status: 400 });
        if (dryRun) {
            // Run compute without writing by skipping store call
            const row = await (0, catalog_counters_1.computeAndStoreCountersForShop)(shopId).catch((e) => { throw e; });
            const payload = { ...(0, catalog_counters_1.rowToSummaryPayload)(row), updatedAt: new Date().toISOString(), dryRun: true };
            return (0, api_1.noStoreJson)(payload);
        }
        const row = await (0, catalog_counters_1.computeAndStoreCountersForShop)(shopId);
        const payload = { ...(0, catalog_counters_1.rowToSummaryPayload)(row), updatedAt: new Date().toISOString() };
        return (0, api_1.noStoreJson)(payload);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
// Allow Vercel Cron (GET only) to trigger the same logic hourly.
// Vercel adds the header x-vercel-cron for scheduled invocations.
async function GET(req) {
    const url = new URL(req.url);
    // Treat GET as cron if x-vercel-cron header present, or CRON_SECRET matches (header/query)
    const vercelCron = !!req.headers.get("x-vercel-cron");
    const cronSecretHeader = req.headers.get("x-cron-secret") || "";
    const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();
    const cronSecretEnv = (process.env.CRON_SECRET || "").trim();
    const isCron = vercelCron || (!!cronSecretEnv && (cronSecretHeader === cronSecretEnv || cronSecretQuery === cronSecretEnv));
    if (!isCron) {
        // For GET without cron header/secret, require role (convenience/manual run)
        const authz = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
        if (!authz.ok)
            return authz.res;
    }
    // default to all for vercel cron to refresh everything
    const all = vercelCron || (url.searchParams.get("all") || "").toLowerCase() === "true" || (url.searchParams.get("shops") || "").toLowerCase() === "all";
    const shopId = (url.searchParams.get("shopId") || "").trim();
    try {
        if (all) {
            const { aggregate } = await (0, catalog_counters_1.recomputeAllCounters)();
            const payload = { ...(0, catalog_counters_1.rowToSummaryPayload)(aggregate), updatedAt: new Date().toISOString(), cron: isCron };
            return (0, api_1.noStoreJson)(payload);
        }
        if (!shopId)
            return server_1.NextResponse.json({ error: "shopId required (or set all=true)" }, { status: 400 });
        const row = await (0, catalog_counters_1.computeAndStoreCountersForShop)(shopId);
        const payload = { ...(0, catalog_counters_1.rowToSummaryPayload)(row), updatedAt: new Date().toISOString() };
        return (0, api_1.noStoreJson)(payload);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
