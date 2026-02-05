"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const reporting_1 = require("@/lib/attendants/reporting");
async function GET(request) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const url = new URL(request.url);
    const rangeDays = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 7)));
    const summary = await (0, reporting_1.getAttendantCategorySummary)(rangeDays);
    return server_1.NextResponse.json({
        since: summary.since.toISOString(),
        days: summary.days,
        categories: summary.categories,
    });
}
