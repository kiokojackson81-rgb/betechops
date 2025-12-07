"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingPeriod_1 = require("@/lib/marketingPeriod");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const supportEntries_1 = require("@/lib/supportEntries");
const marketingCommission_1 = require("@/lib/marketingCommission");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const dateStr = url.searchParams.get("date");
    const impersonateId = url.searchParams.get("impersonateId");
    const actorId = await (0, api_1.getActorId)();
    const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
    if (!targetUserId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const basisDate = dateStr ? new Date(dateStr) : null;
    const period = basisDate ? (0, tradingPeriod_1.getTradingPeriodFor)(basisDate) : await (0, marketingPeriod_1.getCurrentTradingPeriod)();
    // Normalize period for downstream libs when the shape may vary between
    // `tradingPeriod.ts` and `marketingPeriod.ts`. Use `any` to satisfy callers
    // that expect slightly different period types.
    const argPeriod = period;
    const [{ totals: marketingTotals }, supportSummary] = await Promise.all([
        (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({ userId: targetUserId, period: argPeriod }),
        (0, supportEntries_1.getSupportPeriodAggregates)({ userId: targetUserId, period: argPeriod }),
    ]);
    const supportTotals = supportSummary?.aggregates ?? {
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
    };
    const totalSales = marketingTotals.totalSales + supportTotals.totalSales;
    const totalProfit = marketingTotals.totalProfit + supportTotals.totalProfit;
    const totalItems = marketingTotals.totalItems + supportTotals.totalItems;
    const totalReceipts = marketingTotals.totalReceipts + supportTotals.totalReceipts;
    const commissionInfo = (0, marketingCommission_1.getCommissionSummaryForSales)(totalSales);
    let commission = commissionInfo.commission ?? 0;
    if (commission === 0 && totalSales > 0 && totalSales < 500000) {
        commission = Math.round(Math.max(totalProfit, 0) * 0.05);
    }
    // `period` can be the TradingPeriod from `tradingPeriod.ts` (has `start`/`end`)
    // or the one from `marketingPeriod.ts` (has `startDate`/`endDate`). Normalize here.
    let startDate;
    let endDate;
    if ("start" in period && "end" in period) {
        startDate = period.start;
        endDate = period.end;
    }
    else {
        startDate = period.startDate;
        endDate = period.endDate;
    }
    const normalizedPeriod = {
        key: String(period.key ?? ""),
        label: String(period.label ?? ""),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
    };
    return server_1.NextResponse.json({
        period: normalizedPeriod,
        aggregates: {
            totalSales,
            totalProfit,
            totalItems,
            totalReceipts,
            paymentStats: marketingTotals.paymentStats,
            commission: { commission },
        },
    });
}
