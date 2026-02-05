"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const cleanupDuplicatePayoutWeeks_1 = require("@/lib/jobs/cleanupDuplicatePayoutWeeks");
const api_1 = require("@/lib/api");
const server_1 = require("next/server");
async function handler(request) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    try {
        const result = await (0, cleanupDuplicatePayoutWeeks_1.cleanupDuplicatePayoutWeeks)();
        const res = server_1.NextResponse.json({ ok: true, result });
        res.headers.set("Cache-Control", "no-store");
        return res;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return server_1.NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
async function POST(request) {
    return handler(request);
}
async function GET(request) {
    return handler(request);
}
