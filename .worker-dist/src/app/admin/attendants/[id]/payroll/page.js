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
const api_1 = require("@/lib/api");
const Card_1 = __importDefault(require("@/app/_components/Card"));
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
    const summary = await (0, marketingEarnings_1.getEarningsSummaryForAttendant)({ attendantId, periodKey, periodLabel });
    const adjustments = await prisma_1.prisma.attendantPayrollAdjustment.findMany({ where: { attendantId, periodKey }, orderBy: { createdAt: "desc" } });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-6", children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-2xl font-semibold", children: ["Payroll \u2014 ", attendant.name ?? attendant.email] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Manage comp plans and payroll adjustments for this attendant." })] }), (0, jsx_runtime_1.jsx)(PayrollClient_1.default, { attendant: attendant, initialPlan: plan, periodKey: periodKey, periodLabel: periodLabel, initialAdjustments: adjustments, initialSummary: summary })] }));
}
