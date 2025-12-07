"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = StatsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const SensitiveValue_1 = __importDefault(require("./SensitiveValue"));
function StatsCard({ periodLabel, receipts, salesKes, items, commissionKes, currentSalesForTier, nextTarget, }) {
    const hasNextTier = typeof nextTarget === "number" && nextTarget > 0;
    const remaining = hasNextTier
        ? Math.max(0, nextTarget - currentSalesForTier)
        : 0;
    const progress = hasNextTier && nextTarget
        ? Math.min((currentSalesForTier / nextTarget) * 100, 100)
        : 100;
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "h-full border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6 flex items-start justify-between gap-4", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-slate-100", children: "Quick stats" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: periodLabel })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(StatTile, { label: "Receipts", value: receipts }), (0, jsx_runtime_1.jsx)(StatTile, { label: "Sales (KES)", value: salesKes.toLocaleString() }), (0, jsx_runtime_1.jsx)(StatTile, { label: "Commission (KES)", value: (0, jsx_runtime_1.jsx)(SensitiveValue_1.default, { value: commissionKes, format: (v) => Number(v).toLocaleString(), storageKey: "stats:commission" }) }), (0, jsx_runtime_1.jsx)(StatTile, { label: "Items sold", value: items })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Progress" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-200", children: hasNextTier && remaining > 0
                            ? `KES ${remaining.toLocaleString()} more to unlock the next tier`
                            : "You've reached the top tier for this period" }), (0, jsx_runtime_1.jsx)("div", { className: "h-2 w-full overflow-hidden rounded-full bg-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-emerald-500 transition-all", style: { width: `${progress}%` } }) })] })] }));
}
function StatTile({ label, value }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: value })] }));
}
