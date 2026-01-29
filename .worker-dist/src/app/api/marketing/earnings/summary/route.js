"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const earningsSummary_1 = require("@/lib/earningsSummary");
const posReceiptSummary_1 = require("@/lib/posReceiptSummary");
const commission_1 = require("@/lib/commission");
const prisma_1 = require("@/lib/prisma");
const timezone_1 = require("@/lib/timezone");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const impersonate = url.searchParams.get("impersonateId") || url.searchParams.get("attendantId");
    let attendantId = null;
    try {
        if (impersonate && auth.role === "ADMIN") {
            attendantId = impersonate;
        }
        else {
            attendantId = await (0, api_1.getActorId)();
        }
    }
    catch (e) {
        attendantId = await (0, api_1.getActorId)();
    }
    if (!attendantId)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    // Enforce server-resolved trading period for dashboard totals.
    // Do not accept client-supplied `periodKey` or `periodLabel`.
    const urlObj = new URL(req.url);
    if (urlObj.searchParams.has("periodKey") || urlObj.searchParams.has("periodLabel")) {
        return server_1.NextResponse.json({ error: "This endpoint requires a server-resolved trading period; do not supply periodKey/periodLabel." }, { status: 400 });
    }
    const periodKey = period.key;
    const periodLabel = period.label;
    try {
        const userSummary = await (0, earningsSummary_1.getEarningsSummaryForUser)({ userId: attendantId });
        // Load user email to detect Jeniffer special-case so we don't let persisted
        // CommissionLedger values overwrite her computed sales commission.
        const attendant = await prisma_1.prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } });
        const attendantEmail = (attendant?.email ?? "").toLowerCase();
        const isJeniffer = attendantEmail === "jeniffer@betech.co.ke";
        const today = (0, timezone_1.nowInNairobi)();
        const { tiers } = await (0, commission_1.getOrCreateCommissionPeriod)(today);
        let posSummary = null;
        if (isJeniffer) {
            posSummary = await (0, posReceiptSummary_1.summarizePosReceiptsForPeriod)({ start: period.start, end: period.end });
            userSummary.totalSales = posSummary.totalSales;
            userSummary.totalProfit = posSummary.totalProfit;
            // Do NOT override `userSummary.salesCommission` here — `getEarningsSummaryForUser`
            // already applies Jeniffer's prorated-tier rule and provides `jenifferProgress`.
        }
        const ledger = await prisma_1.prisma.commissionLedger.findUnique({
            where: {
                userId_periodStart_periodEnd: {
                    userId: attendantId,
                    periodStart: period.start,
                    periodEnd: period.end,
                },
            },
        });
        // If Jeniffer, prefer the computed `userSummary.salesCommission` and
        // do not apply the CommissionLedger override. For everyone else, prefer
        // persisted ledger values when present.
        let salesCommission = 0;
        if (!isJeniffer) {
            const detail = ledger?.detail;
            const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
            const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;
            salesCommission = marketingCommission + supportCommission;
            if (salesCommission === 0 && ledger) {
                salesCommission = Number(ledger.grossCommission ?? 0);
            }
        }
        if (salesCommission === 0) {
            salesCommission = userSummary.salesCommission;
        }
        const grossCommission = salesCommission +
            userSummary.newProductCommission +
            userSummary.copiedCommission +
            userSummary.editedCommission +
            userSummary.commissionTopUpTotal;
        const totalEarnings = userSummary.baseSalary + userSummary.transportAllowance + grossCommission + userSummary.bonusTotal;
        const totalDeductions = userSummary.chamaTotal +
            userSummary.latenessTotal +
            userSummary.disciplineTotal +
            userSummary.otherDeductionsTotal;
        const netPay = totalEarnings - totalDeductions;
        const summary = {
            periodKey,
            periodLabel,
            sales: userSummary.totalSales,
            baseSalary: userSummary.baseSalary,
            transportAllowance: userSummary.transportAllowance,
            jenifferProgress: userSummary.jenifferProgress ?? null,
            commission: grossCommission,
            bonusTotal: userSummary.bonusTotal,
            chamaTotal: userSummary.chamaTotal,
            latenessTotal: userSummary.latenessTotal,
            disciplineTotal: userSummary.disciplineTotal,
            otherDeductionsTotal: userSummary.otherDeductionsTotal,
            adjustmentEntries: userSummary.adjustmentEntries ?? [],
            totalEarnings,
            totalDeductions,
            netPay,
        };
        return server_1.NextResponse.json({ periodKey, periodLabel, summary });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to compute earnings";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
