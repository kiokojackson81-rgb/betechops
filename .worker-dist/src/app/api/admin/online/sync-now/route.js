"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const onlineSync_1 = require("@/lib/jobs/onlineSync");
const weekWindow_1 = require("@/lib/weekWindow");
async function POST(request) {
    const auth = await (0, api_1.requireRole)(['ADMIN']);
    if (!auth.ok)
        return auth.res;
    const url = new URL(request.url);
    const dayParam = url.searchParams.get('day');
    const day = dayParam ? new Date(dayParam) : new Date();
    const window = (0, weekWindow_1.mondayToSundayNairobiWindow)(day);
    try {
        const result = await (0, onlineSync_1.syncOnlineMarketplaceData)({ periodStart: window.weekStart, periodEnd: window.weekEnd });
        return server_1.NextResponse.json({ ok: true, result });
    }
    catch (err) {
        return server_1.NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}
