"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptDetailsDrawer;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function ReceiptDetailsDrawer({ id, open, onClose }) {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [detail, setDetail] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (!open || !id)
            return;
        let cancelled = false;
        const controller = new AbortController();
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/receipts/${id}`, { cache: "no-store", signal: controller.signal });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body?.error || `Failed to load receipt ${id}`);
                }
                const data = await res.json();
                if (!cancelled)
                    setDetail(data.receipt ?? data);
            }
            catch (err) {
                if (!cancelled)
                    setError(err instanceof Error ? err.message : String(err));
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [open, id]);
    if (!open)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-1", onClick: onClose }), (0, jsx_runtime_1.jsxs)("aside", { className: "w-[420px] max-w-full bg-slate-900/95 border-l border-slate-800 p-4 text-slate-50 shadow-xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Receipt details" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Full receipt view" })] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("button", { onClick: onClose, className: "text-sm text-slate-300 hover:text-white", children: "Close" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [loading && (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Loading..." }), error && (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-rose-400", children: error }), !loading && !error && detail && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: detail.docType ?? "Receipt" }), (0, jsx_runtime_1.jsx)("div", { className: "text-md font-semibold", children: detail.orderRef ?? detail.id }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-500", children: new Date(detail.createdAt).toLocaleString() }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-500", children: [detail.customerName ?? "Customer", " \u2014 ", detail.attendantName ?? "Attendant"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-white/5 bg-slate-950/50 p-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Total" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-lg font-semibold text-emerald-300", children: ["KES ", Number(detail.total ?? 0).toLocaleString("en-KE")] })] }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-sm font-semibold", children: "Items" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 space-y-2", children: Array.isArray(detail.items) && detail.items.length ? (detail.items.map((it) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: it.title }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["Qty: ", it.quantity ?? 1] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-emerald-300", children: ["KES ", Number(it.sellingPrice ?? 0).toLocaleString("en-KE")] })] }, it.id)))) : ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "No items available." })) })] })] }))] })] })] }));
}
