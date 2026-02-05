"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProductUploadsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = __importDefault(require("@/lib/toast"));
const MarkdownRendererClient_1 = __importDefault(require("@/components/MarkdownRendererClient"));
function formatDate(input) {
    const d = new Date(input);
    if (!Number.isFinite(d.valueOf()))
        return "-";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function ProductUploadsCard() {
    const [count, setCount] = (0, react_1.useState)("");
    const [notes, setNotes] = (0, react_1.useState)("");
    const [history, setHistory] = (0, react_1.useState)([]);
    const [busy, setBusy] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        void fetchHistory();
    }, []);
    async function fetchHistory() {
        try {
            const res = await fetch("/api/attendants/activities?metric=PRODUCT_UPLOADS&take=7", { cache: "no-store" });
            if (!res.ok)
                return;
            const data = (await res.json());
            setHistory(data);
        }
        catch {
            // ignore network errors for history
        }
    }
    async function submit() {
        const value = Number(count);
        if (!Number.isInteger(value) || value <= 0) {
            (0, toast_1.default)("Enter how many products you uploaded", "error");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/attendants/activities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    metric: "PRODUCT_UPLOADS",
                    intValue: value,
                    notes: notes.trim() ? notes.trim() : undefined,
                    category: "MARKETING_OPS",
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to save uploads");
            }
            (0, toast_1.default)("Upload count saved", "success");
            setCount("");
            setNotes("");
            await fetchHistory();
        }
        catch (err) {
            (0, toast_1.default)(err instanceof Error ? err.message : "Failed to save", "error");
        }
        finally {
            setBusy(false);
        }
    }
    const total = history.reduce((acc, row) => acc + (row.intValue ?? 0), 0);
    return ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(9,33,38,.95),rgba(9,33,38,.75))] p-4 shadow-lg shadow-cyan-900/30", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: "Product Upload Tracker" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-300", children: "Record catalogue uploads so that QA and finance can reconcile the workload." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right text-xs text-cyan-200", children: [(0, jsx_runtime_1.jsx)("div", { children: "Total logged" }), (0, jsx_runtime_1.jsx)("div", { className: "text-base font-semibold", children: total })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-[1fr_auto]", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-widest text-slate-400", children: "Products uploaded" }), (0, jsx_runtime_1.jsx)("input", { value: count, onChange: (e) => setCount(e.target.value), type: "number", min: "0", step: "1", placeholder: "e.g. 18", className: "mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: submit, disabled: busy, className: "self-end rounded-lg bg-cyan-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 focus:outline-none disabled:opacity-50", children: busy ? "Saving..." : "Log uploads" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-widest text-slate-400", children: "Notes" }), (0, jsx_runtime_1.jsx)("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), maxLength: 200, rows: 2, placeholder: "Optional: account/channel or next steps", className: "mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-xs uppercase tracking-widest text-slate-400", children: "Last submissions" }), (0, jsx_runtime_1.jsxs)("ul", { className: "mt-2 space-y-2", children: [history.map((row) => ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-white", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-lg font-semibold", children: row.intValue ?? 0 }), " products"] }), row.notes ? ((0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: (0, jsx_runtime_1.jsx)(MarkdownRendererClient_1.default, { mdText: String(row.notes) }) })) : null] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: formatDate(row.entryDate) })] }, row.id))), !history.length && ((0, jsx_runtime_1.jsx)("li", { className: "rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500", children: "No uploads logged yet" }))] })] })] }));
}
