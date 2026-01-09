"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickStatsCard = QuickStatsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const useCardLock_1 = require("@/app/_components/useCardLock");
const Card_1 = __importDefault(require("@/app/_components/Card"));
function formatKES(value) {
    return `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}
function QuickStatsCard({ variant = "onlineOps", onlineOps = null, loading = false, }) {
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("onlineops:quickstats");
    if (variant !== "onlineOps")
        return null;
    const rows = onlineOps
        ? [
            { label: "Jumia sales total", value: formatKES(onlineOps.jumiaSales) },
            { label: "Kilimall sales total", value: formatKES(onlineOps.kilimallSales) },
            { label: "Direct sales", value: formatKES(onlineOps.directSales) },
            { label: "Receipts", value: Number(onlineOps.receiptsCount || 0).toLocaleString("en-KE") },
            { label: "Total sales", value: formatKES(onlineOps.totalSales) },
            // Prefer persisted commission_total from server (various field names), fall back to computed `commission`.
            {
                label: "Commission",
                value: formatKES(Number(onlineOps.commissionTotal ?? onlineOps.commission_total ?? onlineOps.commission ?? 0)),
            },
        ]
        : [];
    const progress = onlineOps?.tierProgress ?? 0;
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-slate-100", children: "Quick stats" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [onlineOps?.periodLabel ?? (loading ? "Loading." : "No data"), loading ? "  Refreshing." : ""] })] }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [rows.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "col-span-1 sm:col-span-2 text-sm text-slate-400", children: loading ? "Loading stats." : "No stats available" })), rows.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-3 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: row.label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-lg font-semibold text-emerald-300", children: locked ? "" : row.value })] }, row.label)))] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: "To next tier" }), (0, jsx_runtime_1.jsx)("p", { className: "text-base font-semibold text-slate-100", children: locked
                            ? ""
                            : onlineOps?.tierMessage ??
                                (onlineOps?.toNextTier != null
                                    ? `${formatKES(onlineOps.toNextTier)} more to hit next tier`
                                    : "KES 0 more to hit next tier") }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-400", children: "Memo ladder only; discretionary & may be withheld." }), (0, jsx_runtime_1.jsx)("div", { className: "h-2 rounded-full bg-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200", style: { width: `${Math.round(progress * 100)}%` } }) })] })] }));
}
exports.default = QuickStatsCard;
