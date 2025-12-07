"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OnlineSalesForm;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const ReceiptsEditor_1 = __importDefault(require("@/app/_components/ReceiptsEditor"));
const toast_1 = require("@/lib/ui/toast");
const NEW_RECEIPT = () => ({
    id: crypto.randomUUID(),
    receiptNumber: "",
    sellingTotal: "",
    paymentMethod: "MPESA",
    items: [{ id: crypto.randomUUID(), productName: "", buyingPrice: 0 }],
});
function OnlineSalesForm() {
    const [date, setDate] = (0, react_1.useState)(() => new Date().toISOString().split("T")[0]);
    const [dayOfWeek, setDayOfWeek] = (0, react_1.useState)(() => new Date().toLocaleDateString("en-KE", { weekday: "long" }));
    const [receipts, setReceipts] = (0, react_1.useState)([NEW_RECEIPT()]);
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    const totals = (0, react_1.useMemo)(() => {
        return receipts.reduce((acc, receipt) => {
            const sale = Number(receipt.sellingTotal || 0);
            acc.totalSales += sale;
            acc.totalItems += receipt.items.length;
            return acc;
        }, { totalSales: 0, totalProfit: 0, totalItems: 0 });
    }, [receipts]);
    const resetForm = () => {
        setReceipts([NEW_RECEIPT()]);
        setDate(new Date().toISOString().split("T")[0]);
        setDayOfWeek(new Date().toLocaleDateString("en-KE", { weekday: "long" }));
    };
    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/online/direct-sale", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, dayOfWeek, receipts }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => null);
                throw new Error(error?.error || "Failed to save sales");
            }
            (0, toast_1.showToast)("Direct sales saved", "success");
            resetForm();
            window.dispatchEvent(new CustomEvent("onlineOps:refresh"));
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to save sales", "error");
        }
        finally {
            setSubmitting(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-5 border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-emerald-400", children: "Direct sales" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Record walk-in / WhatsApp receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Buying price will be captured later on the pricing tab. Add every receipt so finance can reconcile." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400", children: ["Date", (0, jsx_runtime_1.jsx)("input", { type: "date", value: date, onChange: (e) => {
                                    setDate(e.target.value);
                                    const next = new Date(e.target.value);
                                    if (!Number.isNaN(next.getTime())) {
                                        setDayOfWeek(next.toLocaleDateString("en-KE", { weekday: "long" }));
                                    }
                                }, className: "rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400", children: ["Day", (0, jsx_runtime_1.jsx)("select", { value: dayOfWeek, onChange: (e) => setDayOfWeek(e.target.value), className: "rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500", children: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ((0, jsx_runtime_1.jsx)("option", { value: day, children: day }, day))) })] })] }), (0, jsx_runtime_1.jsx)(ReceiptsEditor_1.default, { receipts: receipts, setReceipts: setReceipts, totals: totals, hideBuyingPrice: true }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end", children: (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60", onClick: handleSubmit, disabled: submitting, children: submitting ? "Saving…" : "Save today’s sales" }) })] }));
}
