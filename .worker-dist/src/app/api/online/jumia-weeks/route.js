"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
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
        const weeks = await prisma_1.prisma.marketplacePayoutWeek.findMany({
            where: { accountId: assignment.accountId },
            orderBy: { weekEnd: "desc" },
            take: 4,
        });
        const total4Weeks = weeks.reduce((sum, week) => sum + Number(week.grossSales ?? 0), 0);
        return {
            accountId: assignment.accountId,
            accountName: assignment.account.displayName,
            platform: assignment.account.platform,
            weeks: weeks.map((week) => ({
                id: week.id,
                statementNumber: week.statementNumber,
                weekStart: week.weekStart.toISOString(),
                weekEnd: week.weekEnd.toISOString(),
                grossSales: Number(week.grossSales ?? 0),
                payoutAmount: Number(week.payoutAmount ?? 0),
                currency: week.currency,
                isPaid: week.isPaid,
            })),
            total4Weeks,
        };
    }));
    return server_1.NextResponse.json({ accounts: payload });
}
