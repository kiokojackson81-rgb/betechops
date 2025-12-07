"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickStatsCard = QuickStatsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const SensitiveValue_1 = __importDefault(require("./SensitiveValue"));
const toast_1 = require("@/lib/ui/toast");
function QuickStatsCard({ variant = "onlineOps" }) {
    const [stats, setStats] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchStats = async () => {
        if (variant !== "onlineOps")
            return;
        setLoading(true);
        try {
            const res = await fetch("/api/online/summary", { credentials: "same-origin", cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load quick stats");
            const data = await res.json().catch(() => null);
            setStats(data?.stats ?? null);
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to load quick stats", "error");
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchStats();
        const handler = () => fetchStats();
        window.addEventListener("onlineOps:refresh", handler);
        return () => window.removeEventListener("onlineOps:refresh", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Quick stats" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500", children: stats?.periodLabel ?? "Current period" })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5", onClick: fetchStats, disabled: loading, children: loading ? "Refreshing…" : "Refresh" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsx)(StatTile, { label: "Receipts", value: stats?.receipts ?? 0, loading: loading }), (0, jsx_runtime_1.jsx)(StatTile, { label: "Sales (KES)", value: formatCurrency(stats?.salesKes ?? 0), loading: loading }), (0, jsx_runtime_1.jsx)(StatTile, { label: "Commission (KES)", value: loading
                            ? "…"
                            : ((0, jsx_runtime_1.jsx)(SensitiveValue_1.default, { value: stats?.commissionKes ?? 0, format: (v) => `KES ${Number(v).toLocaleString("en-KE")}`, storageKey: `quickstats:commission:${stats?.periodLabel ?? "current"}` })), loading: loading }), (0, jsx_runtime_1.jsx)(StatTile, { label: "Items sold", value: stats?.itemsSold ?? 0, loading: loading })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 space-y-1.5", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Target progress" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: stats
                            ? stats.salesKes >= stats.progressTarget
                                ? "Great work! Target achieved."
                                : `KES ${(stats.progressTarget - stats.salesKes).toLocaleString()} remaining`
                            : "—" }), (0, jsx_runtime_1.jsx)("div", { className: "h-2 w-full overflow-hidden rounded-full bg-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-emerald-500 transition-all", style: { width: `${Math.min(100, ((stats?.salesKes ?? 0) / (stats?.progressTarget || 1)) * 100)}%` } }) })] })] }));
}
function StatTile({ label, value, loading }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/50 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-500", children: label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: loading ? "…" : value })] }));
}
const formatCurrency = (val) => `KES ${Number(val).toLocaleString("en-KE")}`;
