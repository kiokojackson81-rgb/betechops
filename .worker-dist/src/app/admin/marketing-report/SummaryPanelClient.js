"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SummaryPanelClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const date_fns_1 = require("date-fns");
function SummaryPanelClient({ initialFrom, initialTo }) {
    const [from, setFrom] = (0, react_1.useState)(initialFrom);
    const [to, setTo] = (0, react_1.useState)(initialTo);
    const [summary, setSummary] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchSummary = async (f, t) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/marketing-report/summary?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `Status ${res.status}`);
            }
            const data = await res.json();
            setSummary(data);
        }
        catch (err) {
            setError(err?.message || String(err));
            setSummary(null);
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchSummary(from, to);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to]);
    return ((0, jsx_runtime_1.jsxs)("section", { className: "grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Quick summary" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Choose a quick range to view aggregated metrics" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                    const s = (0, date_fns_1.startOfDay)(new Date());
                                    const e = (0, date_fns_1.endOfDay)(new Date());
                                    setFrom((0, date_fns_1.formatISO)(s));
                                    setTo((0, date_fns_1.formatISO)(e));
                                }, className: "rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500", children: "Today" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                    const s = (0, date_fns_1.startOfWeek)(new Date(), { weekStartsOn: 1 });
                                    const e = (0, date_fns_1.endOfWeek)(new Date(), { weekStartsOn: 1 });
                                    setFrom((0, date_fns_1.formatISO)((0, date_fns_1.startOfDay)(s)));
                                    setTo((0, date_fns_1.formatISO)((0, date_fns_1.endOfDay)(e)));
                                }, className: "rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500", children: "This week" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                    const s = (0, date_fns_1.startOfMonth)(new Date());
                                    const e = (0, date_fns_1.endOfMonth)(new Date());
                                    setFrom((0, date_fns_1.formatISO)((0, date_fns_1.startOfDay)(s)));
                                    setTo((0, date_fns_1.formatISO)((0, date_fns_1.endOfDay)(e)));
                                }, className: "rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500", children: "This month" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [loading && (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-300", children: "Loading summary\u2026" }), error && (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-rose-400", children: ["Error: ", error] }), !loading && !summary && !error && (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "No data" })] }), summary && ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-5 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Period sales" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xl font-semibold text-white", children: ["KES ", Math.round(summary.totalSales).toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Period profit" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: summary.totalProfit ? `KES ${Math.round(summary.totalProfit).toLocaleString()}` : "—" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Items sold" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: (summary.totalItems || 0).toLocaleString() })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "MPESA vs Cash" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-200", children: ["MPESA KES ", Math.round(summary.paymentStats?.totalSalesMpesa || 0).toLocaleString(), (0, jsx_runtime_1.jsx)("br", {}), "Cash KES ", Math.round(summary.paymentStats?.totalSalesCash || 0).toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Commission (cumulative)" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xl font-semibold text-white", children: ["KES ", Math.round(summary.commission?.commission || 0).toLocaleString()] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-emerald-300", children: summary.commission?.tiersReached?.length ? `Tiers: ${summary.commission.tiersReached.join(", ")}` : "No tiers reached yet" })] })] }))] }));
}
