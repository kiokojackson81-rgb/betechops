"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PendingPricingPage;
const jsx_runtime_1 = require("react/jsx-runtime");
// src/app/admin/pending-pricing/page.tsx
const WeeklySummary_1 = __importDefault(require("./WeeklySummary"));
const UnpricedOrdersClient_1 = __importDefault(require("./UnpricedOrdersClient"));
const tradingPeriod_1 = require("@/lib/tradingPeriod");
async function PendingPricingPage({ searchParams }) {
    const weeks = (0, tradingPeriod_1.getRecentJumiaWeeks)(2);
    const defaultWeek = weeks[0];
    const selectedWeek = weeks.find((week) => week.key === (searchParams?.week ?? "")) ?? defaultWeek;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-7xl p-6 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Pending pricing" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Review Jumia orders that still need a buying price. Toggle the trading period to view last week or the current week." })] }), (0, jsx_runtime_1.jsxs)("form", { action: "/admin/pending-pricing", method: "get", className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "week", className: "text-xs uppercase tracking-wide text-slate-400", children: "Trading period" }), (0, jsx_runtime_1.jsx)("select", { id: "week", name: "week", defaultValue: selectedWeek.key, className: "rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200", children: weeks.map((week) => ((0, jsx_runtime_1.jsx)("option", { value: week.key, children: week.label }, week.key))) }), (0, jsx_runtime_1.jsx)("button", { type: "submit", className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20", children: "Apply" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)(WeeklySummary_1.default, { period: selectedWeek }), (0, jsx_runtime_1.jsx)(UnpricedOrdersClient_1.default, { period: selectedWeek })] })] }));
}
