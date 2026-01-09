"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReturnsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const toast_1 = require("@/lib/ui/toast");
function ReturnsCard() {
    const [returns, setReturns] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchReturns = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/online/returns", { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load returns");
            const data = await res.json().catch(() => null);
            setReturns(data?.returns ?? []);
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to load returns", "error");
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchReturns();
        window.addEventListener("onlineOps:refresh", fetchReturns);
        return () => window.removeEventListener("onlineOps:refresh", fetchReturns);
    }, []);
    const confirmPickup = async (entry) => {
        const attachmentUrl = window.prompt("Proof attachment URL (optional)") || undefined;
        try {
            const res = await fetch("/api/online/returns/confirm-pickup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ returnId: entry.id, attachmentUrl }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => null);
                throw new Error(error?.error || "Failed to confirm pickup");
            }
            (0, toast_1.showToast)("Return marked as picked", "success");
            fetchReturns();
            window.dispatchEvent(new CustomEvent("onlineOps:refresh"));
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to confirm pickup", "error");
        }
    };
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/40 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Returns SLA" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Pick returns within 7 days to avoid deductions." })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5", onClick: fetchReturns, disabled: loading, children: loading ? "Refreshing…" : "Refresh" })] }), loading && !returns.length ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400", children: "Loading return queue\u2026" })) : null, !loading && returns.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400", children: "No open returns for your accounts." })) : null, (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: returns.map((entry) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-slate-100", children: entry.accountName }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: [entry.platform, " \u2022 Item ", entry.orderItemId] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Expected" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-lg font-semibold text-rose-300", children: ["KES ", entry.expectedAmount.toLocaleString()] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-4 text-xs text-slate-400", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Created: ", new Date(entry.createdAt).toLocaleDateString()] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Due: ", new Date(entry.dueAt).toLocaleDateString()] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Days remaining: ", entry.daysRemaining] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Status: ", entry.status.replace(/_/g, " ")] })] }), entry.status === "WAITING_AT_HUB" ? ((0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:brightness-95", onClick: () => confirmPickup(entry), children: "Confirm picked" })) : null] }, entry.id))) })] }));
}
