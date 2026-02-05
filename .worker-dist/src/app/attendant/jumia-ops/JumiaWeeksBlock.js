"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JumiaWeeksBlock;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const toast_1 = require("@/lib/ui/toast");
function JumiaWeeksBlock() {
    const [accounts, setAccounts] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchWeeks = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/online/jumia-weeks", { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load payout statements");
            const data = await res.json().catch(() => null);
            setAccounts(data?.accounts ?? []);
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to load payout statements", "error");
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchWeeks();
        window.addEventListener("onlineOps:refresh", fetchWeeks);
        return () => window.removeEventListener("onlineOps:refresh", fetchWeeks);
    }, []);
    if (!accounts.length && !loading)
        return null;
    return ((0, jsx_runtime_1.jsxs)("section", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Jumia & Kilimall weeks" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Track the last four paid statements per shop." })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5", onClick: fetchWeeks, disabled: loading, children: loading ? "Refreshing…" : "Refresh" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [accounts.map((account) => ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-3 border-slate-800 bg-slate-900/50 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: account.platform }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold", children: account.accountName })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Total (4 weeks)" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xl font-semibold text-emerald-400", children: ["KES ", account.total4Weeks.toLocaleString()] })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: account.weeks.map((week) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("p", { className: "font-medium text-slate-100", children: [new Date(week.weekStart).toLocaleDateString("en-KE", { month: "short", day: "numeric" }), " -", " ", new Date(week.weekEnd).toLocaleDateString("en-KE", { month: "short", day: "numeric" })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Stmt #", week.statementNumber] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsxs)("p", { className: "font-semibold text-emerald-400", children: ["KES ", week.grossSales.toLocaleString()] }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: week.isPaid ? "Paid" : "Pending" })] })] }, week.id))) })] }, account.accountId))), loading && !accounts.length ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400", children: "Loading payout statements\u2026" })) : null] })] }));
}
