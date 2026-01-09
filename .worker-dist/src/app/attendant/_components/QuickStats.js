"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = QuickStats;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = require("@/lib/ui/toast");
function QuickStats() {
    const [stats, setStats] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/reports/summary?scope=attendant", { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load quick stats");
            const data = await res.json().catch(() => null);
            if (data?.quickStats)
                setStats(data.quickStats);
        }
        catch (err) {
            console.error(err);
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to load quick stats", "error");
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        load();
    }, []);
    const progress = stats && stats.nextTierThreshold > 0 ? Math.min(1, stats.salesKes / stats.nextTierThreshold) : 0;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-inner shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Quick stats" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500", children: stats?.periodLabel ?? "Current period" }), stats?.ledgerId ? (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Ledger: ", stats.ledgerId] }) : null, stats?.commissionSource ? ((0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Commission source: ", stats.commissionSource] })) : null] }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5", onClick: load, disabled: loading, children: loading ? "Refreshing…" : "Refresh" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(Stat, { label: "Receipts", value: stats?.receipts ?? 0, loading: loading }), (0, jsx_runtime_1.jsx)(Stat, { label: "Sales (KES)", value: stats ? stats.salesKes.toLocaleString() : 0, loading: loading }), (0, jsx_runtime_1.jsx)(Stat, { label: "Commission (KES)", value: stats ? stats.commissionKes.toLocaleString() : 0, loading: loading }), (0, jsx_runtime_1.jsx)(Stat, { label: "Items sold", value: stats?.itemsSold ?? 0, loading: loading })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "To next tier" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: stats
                            ? stats.remainingToNextTier <= 0
                                ? "Great work! Target achieved."
                                : `KES ${stats.remainingToNextTier.toLocaleString()} more to hit the next tier`
                            : "-" }), (0, jsx_runtime_1.jsx)("div", { className: "h-2 w-full rounded-full bg-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-emerald-500 transition-all", style: { width: `${progress * 100}%` } }) })] })] }));
}
function Stat({ label, value, loading }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/5 bg-slate-950/50 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-300", children: loading ? "…" : value })] }));
}
