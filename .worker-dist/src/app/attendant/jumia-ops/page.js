"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JumiaOpsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ToastContainer_1 = __importDefault(require("@/app/_components/ToastContainer"));
const QuickStatsCard_1 = require("@/components/QuickStatsCard");
const EarningsCard_1 = require("@/components/EarningsCard");
const OnlineSalesForm_1 = __importDefault(require("./OnlineSalesForm"));
const JumiaWeeksBlock_1 = __importDefault(require("./JumiaWeeksBlock"));
const UnpricedOrdersCard_1 = __importDefault(require("./UnpricedOrdersCard"));
const ReturnsCard_1 = __importDefault(require("./ReturnsCard"));
function JumiaOpsPage() {
    const [tab, setTab] = (0, react_1.useState)("pricing");
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-slate-950 px-4 pb-16 text-slate-50", children: [(0, jsx_runtime_1.jsx)(ToastContainer_1.default, {}), (0, jsx_runtime_1.jsxs)("div", { className: "mx-auto w-full max-w-6xl space-y-8 pt-8", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-emerald-400", children: "Operations" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Jumia / Kilimall Ops" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Log direct sales, monitor online weeks, and action pricing & returns for your assigned accounts." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]", children: [(0, jsx_runtime_1.jsx)(OnlineSalesForm_1.default, {}), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)(QuickStatsCard_1.QuickStatsCard, { variant: "onlineOps" }), (0, jsx_runtime_1.jsx)(EarningsCard_1.EarningsCard, { variant: "onlineOps" })] })] }), (0, jsx_runtime_1.jsx)(JumiaWeeksBlock_1.default, {}), (0, jsx_runtime_1.jsxs)("section", { className: "space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-4 md:p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "inline-flex rounded-full bg-slate-900 p-1", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setTab("pricing"), className: `rounded-full px-4 py-1 text-sm font-medium transition ${tab === "pricing" ? "bg-emerald-500 text-black" : "text-slate-400"}`, children: "Pricing queue" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setTab("returns"), className: `rounded-full px-4 py-1 text-sm font-medium transition ${tab === "returns" ? "bg-emerald-500 text-black" : "text-slate-400"}`, children: "Returns SLA" })] }), tab === "pricing" ? (0, jsx_runtime_1.jsx)(UnpricedOrdersCard_1.default, {}) : (0, jsx_runtime_1.jsx)(ReturnsCard_1.default, {})] })] })] }));
}
