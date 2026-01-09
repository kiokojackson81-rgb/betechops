"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptsEditor;
const jsx_runtime_1 = require("react/jsx-runtime");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const pillClass = (checked) => `rounded-full border px-4 py-2 text-sm font-medium transition ${checked
    ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"}`;
function ReceiptsEditor({ receipts, setReceipts, totals, hideBuyingPrice = false, }) {
    const newSaleRow = () => ({
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        receiptNumber: "",
        sellingTotal: "",
        paymentMethod: "",
        items: [
            {
                id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                productName: "",
                buyingPrice: hideBuyingPrice ? 0 : "",
            },
        ],
    });
    const updateReceipt = (id, patch) => {
        setReceipts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };
    const addReceipt = () => setReceipts((rows) => [...rows, newSaleRow()]);
    const removeReceipt = (id) => setReceipts((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
    const addItem = (receiptId) => {
        setReceipts((rows) => rows.map((r) => r.id === receiptId
            ? {
                ...r,
                items: [
                    ...r.items,
                    {
                        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                        productName: "",
                        buyingPrice: hideBuyingPrice ? 0 : "",
                    },
                ],
            }
            : r));
    };
    const updateItem = (receiptId, itemId, patch) => {
        setReceipts((rows) => rows.map((r) => (r.id === receiptId ? { ...r, items: r.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : r)));
    };
    const removeItem = (receiptId, itemId) => {
        setReceipts((rows) => rows.map((r) => r.id === receiptId
            ? {
                ...r,
                items: r.items.filter((it) => it.id !== itemId).length > 0 ? r.items.filter((it) => it.id !== itemId) : r.items,
            }
            : r));
    };
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Sales records" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Add each receipt for today" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Totals are calculated automatically." })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-3", children: receipts.map((receipt) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-semibold text-slate-200", children: "Receipt" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", type: "button", className: "px-3 py-2 text-xs", onClick: () => removeReceipt(receipt.id), children: "Remove receipt" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Selling total (KES)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: receipt.sellingTotal === "" ? "" : receipt.sellingTotal, onChange: (e) => updateReceipt(receipt.id, { sellingTotal: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) }), placeholder: "0", className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Receipt number (required)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: receipt.receiptNumber, onChange: (e) => updateReceipt(receipt.id, { receiptNumber: e.target.value }), placeholder: "Required", className: "w-full rounded-xl border border-emerald-500 bg-emerald-900/10 px-3 py-2 text-emerald-200" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Payment method ", (0, jsx_runtime_1.jsx)("span", { className: "text-rose-400", children: "(required)" })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: ["MPESA", "CASH"].map((method) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateReceipt(receipt.id, { paymentMethod: method }), className: pillClass(receipt.paymentMethod === method), children: method === "MPESA" ? "MPESA" : "Cash" }, method))) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Products in this receipt" }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2", children: receipt.items.map((item) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 md:items-center " +
                                            (hideBuyingPrice ? "md:grid-cols-[1fr_auto]" : "md:grid-cols-[2fr_1fr_auto]"), children: [(0, jsx_runtime_1.jsx)(Input_1.default, { value: item.productName, onChange: (e) => updateItem(receipt.id, item.id, { productName: e.target.value }), placeholder: "Product name", className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" }), !hideBuyingPrice && ((0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: item.buyingPrice === "" ? "" : item.buyingPrice, onChange: (e) => updateItem(receipt.id, item.id, {
                                                    buyingPrice: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                                                }), placeholder: "Buying price (KES)", className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" })), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", type: "button", className: "px-3 py-2 text-xs", onClick: () => removeItem(receipt.id, item.id), children: "Remove" })] }, item.id))) }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", className: "px-3 py-2 text-xs", onClick: () => addItem(receipt.id), children: "+ Add product to this receipt" })] })] }, receipt.id))) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Total receipts: ", receipts.length] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Total sales (KES): ", totals.totalSales.toLocaleString()] }), !hideBuyingPrice && (0, jsx_runtime_1.jsxs)("div", { children: ["Total profit (KES): ", totals.totalProfit.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Total items: ", totals.totalItems] })] }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", className: "px-4", onClick: addReceipt, children: "+ Add receipt" })] })] }));
}
