"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminPayrollPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const api_1 = require("@/lib/api");
const PayrollTableClient_1 = __importDefault(require("./PayrollTableClient"));
exports.dynamic = "force-dynamic";
const baseSummary = () => ({
    totalBonus: 0,
    totalDeduction: 0,
    breakdown: {
        chama: 0,
        lateness: 0,
        discipline: 0,
        other: 0,
        bonus: 0,
        commissionTopUp: 0,
        penalties: 0,
    },
});
async function AdminPayrollPage() {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok) {
        (0, navigation_1.redirect)("/admin/login");
    }
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const periodKey = period.key;
    const attendants = await prisma_1.prisma.user.findMany({
        where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
        orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            email: true,
            attendantCategory: true,
            isActive: true,
        },
    });
    const attendantIds = attendants.map((attendant) => attendant.id);
    const [plans, ledgers, adjustments] = await Promise.all([
        prisma_1.prisma.attendantCompPlan.findMany({ where: { attendantId: { in: attendantIds } } }),
        prisma_1.prisma.commissionLedger.findMany({
            where: {
                periodStart: period.start,
                periodEnd: period.end,
                userId: { in: attendantIds },
            },
        }),
        prisma_1.prisma.attendantPayrollAdjustment.findMany({
            where: { periodKey, attendantId: { in: attendantIds } },
            orderBy: { createdAt: "desc" },
        }),
    ]);
    const planMap = new Map(plans.map((plan) => [plan.attendantId, plan]));
    const ledgerMap = new Map(ledgers.map((ledger) => [ledger.userId, ledger]));
    const adjustmentsByAttendant = new Map();
    for (const adjustment of adjustments) {
        const existing = adjustmentsByAttendant.get(adjustment.attendantId) ?? baseSummary();
        const amount = adjustment.amount ?? 0;
        const bonusType = adjustment.adjustmentType === "BONUS";
        const topUpType = adjustment.adjustmentType === "COMMISSION_TOPUP";
        if (bonusType) {
            existing.totalBonus += amount;
            existing.breakdown.bonus += amount;
        }
        else if (topUpType) {
            existing.totalBonus += amount;
            existing.breakdown.commissionTopUp += amount;
        }
        else {
            existing.totalDeduction += amount;
            if (adjustment.adjustmentType === "CHAMA")
                existing.breakdown.chama += amount;
            if (adjustment.adjustmentType === "LATENESS")
                existing.breakdown.lateness += amount;
            if (adjustment.adjustmentType === "DISCIPLINE")
                existing.breakdown.discipline += amount;
            if (adjustment.adjustmentType === "OTHER")
                existing.breakdown.other += amount;
        }
        adjustmentsByAttendant.set(adjustment.attendantId, existing);
    }
    const rows = attendants.map((attendant) => {
        const plan = planMap.get(attendant.id);
        const ledger = ledgerMap.get(attendant.id);
        const summary = adjustmentsByAttendant.get(attendant.id) ?? baseSummary();
        const commissions = Number(ledger?.netCommission ?? ledger?.grossCommission ?? 0);
        const grossCommission = Number(ledger?.grossCommission ?? 0);
        const penalties = Number(ledger?.penalties ?? 0);
        const detail = ledger?.detail;
        const baseSalary = plan?.baseSalary ?? 0;
        const transportAllowance = plan?.defaultTransportAllowance ?? 0;
        const totalEarnings = baseSalary + transportAllowance + commissions + summary.totalBonus;
        const totalDeductions = summary.totalDeduction + penalties;
        const netPay = totalEarnings - totalDeductions;
        summary.breakdown.penalties = penalties;
        return {
            attendantId: attendant.id,
            name: attendant.name,
            email: attendant.email,
            attendantCategory: attendant.attendantCategory,
            isActive: attendant.isActive,
            baseSalary,
            transportAllowance,
            commission: commissions,
            commissionGross: grossCommission,
            bonusTotal: summary.totalBonus,
            deductionTotal: totalDeductions,
            totalEarnings,
            totalDeductions,
            netPay,
            totalSales: Number(detail?.totalSales ?? 0),
            totalProfit: Number(detail?.totalProfit ?? 0),
            adjustmentBreakdown: summary.breakdown,
        };
    });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Admin payroll" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["Snapshot for ", period.label, ". Data comes from commission-ledger, comp plans and adjustments."] })] }), (0, jsx_runtime_1.jsx)(PayrollTableClient_1.default, { rows: rows, periodLabel: period.label })] }));
}
