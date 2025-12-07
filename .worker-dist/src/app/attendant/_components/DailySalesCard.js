"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DailySalesCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const toast_1 = __importDefault(require("@/lib/toast"));
function formatMoney(value) {
    return `KES ${new Intl.NumberFormat().format(value)}`;
}
function formatDate(input) {
    const d = new Date(input);
    if (!Number.isFinite(d.valueOf()))
        return "-";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function DailySalesCard() {
    const [amount, setAmount] = (0, react_1.useState)("");
    const [notes, setNotes] = (0, react_1.useState)("");
    const [history, setHistory] = (0, react_1.useState)([]);
    const [busy, setBusy] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        void fetchHistory();
    }, []);
    async function fetchHistory() {
        try {
            const res = await fetch("/api/attendants/activities?metric=DAILY_SALES&take=7", { cache: "no-store" });
            if (!res.ok)
                return;
            const data = (await res.json());
            setHistory(data);
        }
        catch {
            // non-fatal
        }
    }
    async function submit() {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            (0, toast_1.default)("Enter a valid sales amount", "error");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/attendants/activities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    metric: "DAILY_SALES",
                    numericValue: value,
                    notes: notes.trim() ? notes.trim() : undefined,
                    category: "DIRECT_SALES_OPS",
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to save daily sales");
            }
            (0, toast_1.default)("Daily sales submitted", "success");
            setAmount("");
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
    const latestTotal = history.reduce((acc, item) => {
        const numeric = typeof item.numericValue === "string" ? Number(item.numericValue) : item.numericValue ?? 0;
        return acc + (Number.isFinite(numeric) ? Number(numeric) : 0);
    }, 0);
    return ((0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(20,30,45,.9),rgba(20,30,45,.7))] p-4 shadow-lg shadow-black/30", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: "Daily Sales" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Log your cash or POS takings at the end of each shift." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right text-xs text-slate-400", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Total (last ", history.length, " entries)"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-base font-semibold text-emerald-300", children: formatMoney(latestTotal) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-[1fr_auto]", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Amount" }), (0, jsx_runtime_1.jsx)("input", { value: amount, onChange: (e) => setAmount(e.target.value), type: "number", min: "0", step: "0.01", placeholder: "e.g. 18500", className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: submit, disabled: busy, className: "self-end rounded-lg bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none disabled:opacity-60", children: busy ? "Saving..." : "Submit" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Notes" }), (0, jsx_runtime_1.jsx)("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), maxLength: 200, rows: 2, placeholder: "Optional notes (cash vs MPESA, special orders, etc.)", className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-xs uppercase tracking-widest text-slate-400", children: "Recent entries" }), (0, jsx_runtime_1.jsxs)("ul", { className: "mt-2 space-y-2", children: [history.map((row) => {
                                const numeric = typeof row.numericValue === "string" ? Number(row.numericValue) : row.numericValue ?? 0;
                                return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: formatMoney(Number.isFinite(numeric) ? Number(numeric) : 0) }), row.notes ? (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: row.notes }) : null] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: formatDate(row.entryDate) })] }, row.id));
                            }), !history.length && (0, jsx_runtime_1.jsx)("li", { className: "rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500", children: "No entries yet" })] })] })] }));
}
