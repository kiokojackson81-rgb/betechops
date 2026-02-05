"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const onlineSync_1 = require("@/lib/jobs/onlineSync");
exports.dynamic = "force-dynamic";
async function requireAdmin() {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN") {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}
function parsePeriodKey(periodKey) {
    if (!periodKey)
        return null;
    const parts = periodKey.split("_");
    if (parts.length !== 2)
        return null;
    const start = new Date(parts[0]);
    const end = new Date(parts[1]);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return null;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
async function handleSync(request) {
    const forbidden = await requireAdmin();
    if (forbidden)
        return forbidden;
    const url = new URL(request.url);
    const periodKey = url.searchParams.get("periodKey") ?? undefined;
    const lookbackQuery = url.searchParams.get("lookbackDays");
    const lookbackDays = lookbackQuery ? Number(lookbackQuery) : undefined;
    const opts = {};
    if (periodKey) {
        const period = parsePeriodKey(periodKey);
        if (period) {
            opts.periodStart = period.start;
            opts.periodEnd = period.end;
        }
    }
    if (!opts.periodStart && !opts.periodEnd && Number.isFinite(lookbackDays ?? NaN) && lookbackDays > 0) {
        opts.lookbackDays = lookbackDays;
    }
    if (!opts.periodStart && !opts.periodEnd && !opts.lookbackDays) {
        opts.lookbackDays = Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 30);
    }
    try {
        await (0, onlineSync_1.syncOnlineMarketplaceData)(opts);
        return server_1.NextResponse.json({ ok: true, params: opts });
    }
    catch (error) {
        console.error("[api/jumia/sync-online-orders] failed", error);
        return server_1.NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "sync_failed" }, { status: 500 });
    }
}
async function POST(request) {
    return handleSync(request);
}
async function GET(request) {
    return handleSync(request);
}
