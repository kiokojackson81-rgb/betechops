"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const recomputeWeeklySummaries_1 = require("../../../../lib/jobs/recomputeWeeklySummaries");
const onlineOps_1 = require("@/lib/onlineOps");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const { assignments } = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(auth.user.id);
    if (!assignments.length) {
        return server_1.NextResponse.json({ accounts: [] });
    }
    const payload = await Promise.all(assignments.map(async (assignment) => {
        // Use grouped aggregates to avoid duplicate rows skewing totals
        const weekAggs = (await (0, recomputeWeeklySummaries_1.recomputeWeeklySummary)(new Date(0), new Date())).filter((a) => a.accountId === assignment.accountId);
        // sort by weekStart desc and take 4
        weekAggs.sort((x, y) => y.weekStart.getTime() - x.weekStart.getTime());
        const weeks = weekAggs.slice(0, 4);
        const total4Weeks = weeks.reduce((sum, w) => sum + Number(w.totalGross ?? 0), 0);
        return {
            accountId: assignment.accountId,
            accountName: assignment.account.displayName,
            platform: assignment.account.platform,
            weeks: weeks.map((week) => ({
                id: null,
                statementNumber: null,
                weekStart: week.weekStart.toISOString(),
                weekEnd: week.weekEnd.toISOString(),
                grossSales: Number(week.totalGross ?? 0),
                payoutAmount: Number(week.totalPayout ?? 0),
                currency: 'LOCAL',
                isPaid: true,
            })),
            total4Weeks,
        };
    }));
    return server_1.NextResponse.json({ accounts: payload });
}
