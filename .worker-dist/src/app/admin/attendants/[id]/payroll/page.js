"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = PayrollPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const PayrollClient_1 = __importDefault(require("./PayrollClient"));
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingEarnings_1 = require("@/lib/marketingEarnings");
const earningsSummary_1 = require("@/lib/earningsSummary");
const api_1 = require("@/lib/api");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const payrollPeriodKey_1 = require("@/lib/payrollPeriodKey");
exports.dynamic = "force-dynamic";
async function PayrollPage({ params }) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok) {
        (0, navigation_1.redirect)("/admin/login");
    }
    const awaitedParams = await params;
    const attendantId = awaitedParams.id;
    const attendant = await prisma_1.prisma.user.findUnique({ where: { id: attendantId }, select: { id: true, name: true, email: true } });
    if (!attendant) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "p-6", children: (0, jsx_runtime_1.jsx)(Card_1.default, { className: "border-red-500/30 bg-red-900/10", children: "Attendant not found" }) }));
    }
    const plan = await prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId } });
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const periodKey = period.key;
    const periodLabel = period.label;
    const currentLedgerRaw = (await prisma_1.prisma.commissionLedger.findUnique({
        where: {
            userId_periodStart_periodEnd: {
                userId: attendantId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
    })) ?? null;
    // Prefer the more robust earnings summary implementation which tolerates
    // multiple periodKey formats and honours payroll adjustment kinds. Fall
    // back to the older marketing earnings helper if needed.
    let summary = null;
    try {
        const userSummary = await (0, earningsSummary_1.getEarningsSummaryForUser)({ userId: attendantId, asOf: new Date() });
        const ledgerDetail = currentLedgerRaw?.detail;
        const marketingCommissionValue = ledgerDetail && typeof ledgerDetail === "object" ? Number(ledgerDetail.marketing?.commission ?? 0) : 0;
        const supportCommissionValue = ledgerDetail && typeof ledgerDetail === "object" ? Number(ledgerDetail.support?.commission ?? 0) : 0;
        const isJeniffer = (attendant?.email ?? "").toLowerCase() === "jeniffer@betech.co.ke";
        // For Jeniffer we must prefer the computed `userSummary.salesCommission`
        // and not allow persisted ledger values to overwrite it. For other
        // attendants prefer ledger-derived values when present.
        let ledgerSalesCommission = 0;
        if (!isJeniffer) {
            ledgerSalesCommission = marketingCommissionValue + supportCommissionValue;
            if (ledgerSalesCommission === 0 && currentLedgerRaw) {
                ledgerSalesCommission = Number(currentLedgerRaw.grossCommission ?? 0);
            }
        }
        if (ledgerSalesCommission === 0) {
            ledgerSalesCommission = userSummary.salesCommission;
        }
        const grossCommission = ledgerSalesCommission +
            userSummary.newProductCommission +
            userSummary.copiedCommission +
            userSummary.editedCommission +
            userSummary.commissionTopUpTotal;
        const bonusTotal = userSummary.bonusTotal ?? 0;
        const totalDeductions = userSummary.chamaTotal +
            userSummary.latenessTotal +
            userSummary.disciplineTotal +
            userSummary.otherDeductionsTotal;
        const totalEarnings = userSummary.baseSalary + userSummary.transportAllowance + grossCommission + bonusTotal;
        const netPay = totalEarnings - totalDeductions;
        summary = {
            ...userSummary,
            salesCommission: ledgerSalesCommission,
            grossCommission,
            totalEarnings,
            totalDeductions,
            netPay,
            commission: grossCommission,
            sales: userSummary.totalSales,
        };
    }
    catch (e) {
        // fallback to existing implementation if the new helper fails for any reason
        try {
            const old = await (0, marketingEarnings_1.getEarningsSummaryForAttendant)({ attendantId, periodKey, periodLabel });
            summary = { sales: old.sales ?? 0, netPay: old.netPay ?? 0, _raw: old };
        }
        catch (err) {
            summary = { sales: 0, netPay: 0 };
        }
    }
    const periodKeyVariants = (0, payrollPeriodKey_1.getPeriodKeyVariantsFromDates)(period.start, period.end);
    const adjustmentKeys = periodKeyVariants.length ? periodKeyVariants : [periodKey];
    const adjustments = await prisma_1.prisma.attendantPayrollAdjustment.findMany({
        where: { attendantId, periodKey: { in: adjustmentKeys } },
        orderBy: { createdAt: "desc" },
    });
    const currentLedger = currentLedgerRaw === null
        ? null
        : {
            commissionDirect: Number(currentLedgerRaw.commissionDirect ?? 0),
            commissionMarketplaceJumia: Number(currentLedgerRaw.commissionMarketplaceJumia ?? 0),
            commissionMarketplaceKilimall: Number(currentLedgerRaw.commissionMarketplaceKilimall ?? 0),
            netCommission: Number(currentLedgerRaw.netCommission ?? 0),
            commissionBreakdown: typeof currentLedgerRaw.commissionBreakdown === "object" && currentLedgerRaw.commissionBreakdown !== null
                ? Object.fromEntries(Object.entries(currentLedgerRaw.commissionBreakdown).map(([key, value]) => [
                    key,
                    typeof value === "object" && value !== null && "toNumber" in value
                        ? Number(value.toNumber())
                        : Number(value ?? 0),
                ]))
                : {},
        };
    const recentPeriods = (0, tradingPeriod_1.getRecentTradingPeriods)(2);
    const previousPeriod = recentPeriods.length > 1 ? recentPeriods[1] : null;
    const previousLedgerRaw = previousPeriod &&
        (await prisma_1.prisma.commissionLedger.findUnique({
            where: {
                userId_periodStart_periodEnd: {
                    userId: attendantId,
                    periodStart: previousPeriod.start,
                    periodEnd: previousPeriod.end,
                },
            },
        }));
    const previousLedger = previousLedgerRaw
        ? { netCommission: Number(previousLedgerRaw.netCommission ?? 0) }
        : null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-6", children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-2xl font-semibold", children: ["Payroll \u2014 ", attendant.name ?? attendant.email] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Manage comp plans and payroll adjustments for this attendant." })] }), (0, jsx_runtime_1.jsx)(PayrollClient_1.default, { attendant: attendant, initialPlan: plan, periodKey: periodKey, periodLabel: periodLabel, initialAdjustments: adjustments, initialSummary: summary, ledger: currentLedger, previousLedger: previousLedger ?? null })] }));
}
