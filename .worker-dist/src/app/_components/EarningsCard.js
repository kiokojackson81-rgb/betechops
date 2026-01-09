"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EarningsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const Card_1 = __importDefault(require("./Card"));
const useCardLock_1 = require("./useCardLock");
const formatCurrency = (value) => `KES ${value.toLocaleString("en-US")}`;
function EarningsCard({ summary, lockKey, }) {
    const { locked, toggle } = (0, useCardLock_1.useCardLock)(lockKey ?? "earnings:default");
    if (!summary)
        return null;
    const rows = [
        { label: "Base salary", value: summary.baseSalary },
        { label: "Transport allowance", value: summary.transportAllowance },
        { label: "Sales commission", value: summary.salesCommission },
        { label: "Battery earnings", value: summary.batteryEarnings ?? 0 },
        { label: "New product commission", value: summary.newProductCommission },
        { label: "Copied product commission", value: summary.copiedCommission },
        { label: "Edited product commission", value: summary.editedCommission },
        { label: "Commission top-up", value: summary.commissionTopUpTotal },
        { label: "Bonuses", value: summary.bonusTotal },
        { label: "Chama deduction", value: -summary.chamaTotal },
        { label: "Lateness deductions", value: -summary.latenessTotal },
        { label: "Discipline deductions", value: -summary.disciplineTotal },
        { label: "Other deductions", value: -summary.otherDeductionsTotal },
    ]
        .filter((row) => row.value !== 0)
        .map((row) => ({
        ...row,
        formatted: row.value < 0 ? `- ${formatCurrency(Math.abs(row.value))}` : formatCurrency(row.value),
    }));
    const mask = (val) => (locked ? "•••" : val);
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/60", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Earnings summary" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["For ", summary.periodLabel] })] }), lockKey ? (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle }) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-emerald-500/30 bg-black/20 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Net pay" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold text-emerald-300", children: mask(formatCurrency(summary.netPay)) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 text-sm text-slate-100", children: [rows.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: row.label }), (0, jsx_runtime_1.jsx)("span", { children: mask(row.formatted) })] }, row.label))), summary.adjustmentEntries && summary.adjustmentEntries.length > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "pt-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Adjustments" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 space-y-2", children: summary.adjustmentEntries.map((e) => {
                                    const isAddition = (String(e.adjustmentKind || "DEDUCTION").toUpperCase() === "ADDITION");
                                    const val = isAddition ? e.amount : -Math.abs(e.amount);
                                    const formatted = val < 0 ? `- ${formatCurrency(Math.abs(val))}` : formatCurrency(val);
                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: e.label }), (0, jsx_runtime_1.jsx)("span", { children: mask(formatted) })] }, e.id));
                                }) })] })) : null] })] }));
}
