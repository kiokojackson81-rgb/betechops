"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jobs/jumia");
const server_1 = require("next/server");
async function handle(request) {
    // Allow headless cron via secret (header or query): x-cron-secret / cronSecret
    const url = new URL(request.url);
    const cronSecretHeader = request.headers.get("x-cron-secret") || "";
    const vercelCronHeader = request.headers.get("x-vercel-cron") || ""; // present on Vercel scheduled requests
    const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();
    const cronSecretEnv = (process.env.CRON_SECRET || "").trim();
    const isCronBySecret = !!cronSecretEnv && (cronSecretHeader === cronSecretEnv || cronSecretQuery === cronSecretEnv);
    const isCronByVercelHeader = vercelCronHeader !== "";
    const isCron = isCronBySecret || isCronByVercelHeader;
    if (!isCron) {
        const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
        if (!auth.ok)
            return auth.res;
    }
    const opts = {};
    const shopIdParam = url.searchParams.get("shopId");
    if (shopIdParam)
        opts.shopId = shopIdParam;
    const lookbackParam = url.searchParams.get("lookbackDays");
    if (lookbackParam) {
        const parsed = Number.parseInt(lookbackParam, 10);
        if (Number.isFinite(parsed) && parsed > 0)
            opts.lookbackDays = parsed;
    }
    try {
        const summary = await (0, jumia_1.syncOrdersIncremental)(opts);
        if (isCron) {
            const res = server_1.NextResponse.json({ ok: true, cron: true, summary });
            res.headers.set("Cache-Control", "no-store");
            return res;
        }
        return (0, api_1.noStoreJson)({ ok: true, summary });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return (0, api_1.noStoreJson)({ ok: false, error: message }, { status: 500 });
    }
}
async function POST(request) {
    return handle(request);
}
// Some platforms (e.g., Vercel Cron) invoke the URL with GET.
// Support GET by delegating to the same handler.
async function GET(request) {
    return handle(request);
}
