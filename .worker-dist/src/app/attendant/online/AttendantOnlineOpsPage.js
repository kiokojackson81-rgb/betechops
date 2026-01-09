"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantOnlineOpsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
// This page implements the updated online operations dashboard for attendants.
// It replaces the static sales records call‑to‑action with an interactive
// receipt form (inspired by the daily report page) and computes summary
// statistics such as total receipts, sales, items and a simple commission.
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
function AttendantOnlineOpsPage() {
    // Maintain an array of receipt entries. Start with one empty receipt so
    // attendants have a place to begin inputting data.
    const [receipts, setReceipts] = (0, react_1.useState)([
        { sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [""] },
    ]);
    /**
     * Update a given receipt with partial data. This helper spreads the
     * existing receipt object with the provided changes and returns a new
     * array to trigger a re‑render.
     */
    const updateReceipt = (index, data) => {
        setReceipts((prev) => prev.map((r, i) => (i === index ? { ...r, ...data } : r)));
    };
    /**
     * Append a blank receipt to the receipts array so the attendant can
     * continue logging additional transactions.
     */
    const addReceipt = () => {
        setReceipts((prev) => [
            ...prev,
            { sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [""] },
        ]);
    };
    /**
     * Update a single product name within a given receipt. If an attendant
     * edits a product name, this helper returns a new receipts array with
     * the updated string at the correct index.
     */
    const updateProduct = (receiptIndex, productIndex, value) => {
        setReceipts((prev) => {
            const newReceipts = [...prev];
            const products = [...newReceipts[receiptIndex].products];
            products[productIndex] = value;
            newReceipts[receiptIndex] = {
                ...newReceipts[receiptIndex],
                products,
            };
            return newReceipts;
        });
    };
    /**
     * Append a blank product field to the selected receipt. This allows
     * attendants to log multiple items under one receipt.
     */
    const addProduct = (receiptIndex) => {
        setReceipts((prev) => {
            const newReceipts = [...prev];
            const products = [...newReceipts[receiptIndex].products, ""];
            newReceipts[receiptIndex] = {
                ...newReceipts[receiptIndex],
                products,
            };
            return newReceipts;
        });
    };
    // Derived totals: compute total sales, number of receipts, total items and
    // a simple commission (2% of sales) to give attendants immediate feedback.
    const totalSales = receipts.reduce((sum, r) => sum + r.sellingTotal, 0);
    const numReceipts = receipts.length;
    const numItems = receipts.reduce((sum, r) => sum + r.products.filter((p) => p.trim() !== "").length, 0);
    const commissionRate = 0.02; // Example commission: 2% of gross sales
    const commission = totalSales * commissionRate;
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 px-4 pb-16 text-slate-50", children: (0, jsx_runtime_1.jsxs)("div", { className: "mx-auto w-full max-w-6xl space-y-8 pt-8", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-emerald-400", children: "Jumia / Kilimall Ops" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Online sales dashboard" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Record every receipt through the form below. Marketplace statements now sync automatically and are reviewed by admins. Only approved entries contribute to your commissions." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-3 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-900 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: "Receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: numReceipts })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-900 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: "Sales (KES)" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: totalSales.toFixed(0) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-900 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: "Items" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: numItems })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-3xl border border-white/10 bg-slate-900/70 p-6", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400", children: "Sales records" }), (0, jsx_runtime_1.jsx)("h2", { className: "mt-2 text-xl font-semibold text-white", children: "Add each receipt for today" }), receipts.map((receipt, rIndex) => ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm text-slate-400", children: "Selling total (KES)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: receipt.sellingTotal, onChange: (e) => updateReceipt(rIndex, {
                                                                        sellingTotal: Number(e.target.value),
                                                                    }), className: "mt-1 w-full rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500", placeholder: "0", min: "0" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm text-slate-400", children: "Receipt number (required)" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: receipt.receiptNumber, onChange: (e) => updateReceipt(rIndex, { receiptNumber: e.target.value }), className: "mt-1 w-full rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500", placeholder: "Required" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm text-slate-400", children: "Payment method" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 flex", children: ["MPESA", "Cash"].map((method) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateReceipt(rIndex, { paymentMethod: method }), className: `flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${receipt.paymentMethod === method
                                                                            ? "bg-emerald-500 text-black"
                                                                            : "border border-white/10 bg-slate-900 text-slate-300"}`, children: method }, method))) })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm text-slate-400", children: "Products in this receipt" }), receipt.products.map((prod, pIndex) => ((0, jsx_runtime_1.jsx)("input", { type: "text", value: prod, onChange: (e) => updateProduct(rIndex, pIndex, e.target.value), className: "mt-1 w-full rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500", placeholder: "Product name" }, pIndex))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => addProduct(rIndex), className: "mt-2 rounded-full border border-emerald-500 px-4 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500 hover:text-black", children: "+ Add product" })] })] }, rIndex))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: addReceipt, className: "mt-4 rounded-full border border-emerald-500 px-6 py-2 text-sm font-semibold text-emerald-500 hover:bg-emerald-500 hover:text-black", children: "+ Add receipt" })] })] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)("div", { className: "rounded-3xl border border-white/10 bg-slate-900/70 p-6", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400", children: "Earnings summary" }), (0, jsx_runtime_1.jsx)("h3", { className: "mt-2 text-xl font-semibold text-white", children: "Net pay" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Total sales: KES ", totalSales.toFixed(0)] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Commission (", (commissionRate * 100).toFixed(0), "%): KES ", commission.toFixed(0)] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-emerald-400", children: ["Net pay: KES ", (totalSales + commission).toFixed(0)] })] })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-8 flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: "/attendant/daily-report", className: "rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95", children: "Open daily report" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/online/manual", className: "rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10", children: "Admin desk" })] })] }) }));
}
