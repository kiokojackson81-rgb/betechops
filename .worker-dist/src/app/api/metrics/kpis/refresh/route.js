"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const kpis_1 = require("@/lib/jobs/kpis");
async function POST() {
    try {
        const payload = await (0, kpis_1.updateKpisCacheExact)();
        return server_1.NextResponse.json({ ok: true, payload });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return new server_1.NextResponse(msg, { status: 500 });
    }
}
async function GET() {
    // Allow GET for convenience (idempotent cache recompute)
    return POST();
}
