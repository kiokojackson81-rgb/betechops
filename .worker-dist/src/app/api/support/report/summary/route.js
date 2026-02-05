"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const auth_1 = require("@/lib/auth");
const supportEntries_1 = require("@/lib/supportEntries");
const marketingCommission_1 = require("@/lib/marketingCommission");
const commission_1 = require("@/lib/commission");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["SUPPORT_OPS", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    let basisDate = new Date();
    try {
        const url = new URL(req.url);
        const dateParam = url.searchParams.get("date");
        if (dateParam) {
            const parsed = new Date(dateParam);
            if (!Number.isNaN(parsed.getTime()))
                basisDate = parsed;
        }
    }
    catch {
        // ignore malformed URLs and fall back to current date
    }
    await (0, commission_1.getOrCreateCommissionPeriod)(basisDate);
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(basisDate);
    const summary = await (0, supportEntries_1.getSupportPeriodAggregates)({ userId: auth.user.id, period });
    const aggregates = summary.aggregates;
    const commission = (0, marketingCommission_1.getCommissionSummaryForSales)(aggregates.totalSales);
    return server_1.NextResponse.json({
        period: {
            key: period.key,
            label: period.label,
            start: period.start.toISOString(),
            end: period.end.toISOString(),
        },
        aggregates: {
            ...aggregates,
            batteryEarnings: (aggregates.newBatteries + aggregates.changedBatteries) * 70,
            commission: commission.commission,
            nextTarget: commission.nextTarget,
        },
    });
}
