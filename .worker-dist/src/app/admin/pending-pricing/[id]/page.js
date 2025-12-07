"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PendingPricingDetail;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const link_1 = __importDefault(require("next/link"));
const FinalizePricingButton_1 = __importDefault(require("./_actions/FinalizePricingButton"));
function fmtKsh(n) { return `Ksh ${n.toLocaleString()}`; }
async function PendingPricingDetail({ params }) {
    const { id } = await params;
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: {
            shop: { select: { name: true } },
            items: {
                select: {
                    id: true, quantity: true, sellingPrice: true,
                    product: { select: { name: true, sku: true, sellingPrice: true } },
                },
            },
        },
    });
    if (!order) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-4xl p-6", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-slate-300", children: "Order not found." }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/pending-pricing", className: "mt-4 inline-block rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Back" })] }));
    }
    // compute estimated totals
    const rows = order.items.map((it) => {
        const unit = typeof it.sellingPrice === "number" ? it.sellingPrice : (it.product?.sellingPrice ?? 0);
        const sub = unit * it.quantity;
        return { ...it, unit, sub };
    });
    const total = rows.reduce((s, it) => s + it.sub, 0);
    const qty = rows.reduce((s, it) => s + it.quantity, 0);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-5xl p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-4 flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-2xl font-semibold", children: ["Pending Pricing \u00B7 ", order.orderNumber] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-slate-400 text-sm", children: ["Shop: ", order.shop?.name || "—"] })] }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/pending-pricing", className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Back" })] }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-2xl border border-white/10", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/5", children: (0, jsx_runtime_1.jsxs)("tr", { className: "[&>th]:px-3 [&>th]:py-2 text-left text-slate-300", children: [(0, jsx_runtime_1.jsx)("th", { children: "Product" }), (0, jsx_runtime_1.jsx)("th", { children: "SKU" }), (0, jsx_runtime_1.jsx)("th", { children: "Qty" }), (0, jsx_runtime_1.jsx)("th", { children: "Unit" }), (0, jsx_runtime_1.jsx)("th", { children: "Subtotal" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { className: "divide-y divide-white/10", children: [rows.map((it) => ((0, jsx_runtime_1.jsxs)("tr", { className: "[&>td]:px-3 [&>td]:py-2", children: [(0, jsx_runtime_1.jsx)("td", { children: it.product?.name || "—" }), (0, jsx_runtime_1.jsx)("td", { className: "font-mono", children: it.product?.sku || "—" }), (0, jsx_runtime_1.jsx)("td", { children: it.quantity }), (0, jsx_runtime_1.jsx)("td", { children: fmtKsh(it.unit) }), (0, jsx_runtime_1.jsx)("td", { children: fmtKsh(it.sub) })] }, it.id))), rows.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 5, className: "px-3 py-8 text-center text-slate-400", children: "No items." }) }))] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Items" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-2xl font-semibold", children: qty })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Estimated Total" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-2xl font-semibold", children: fmtKsh(total) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Status" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-2xl font-semibold", children: order.status })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 flex gap-3", children: (0, jsx_runtime_1.jsx)(FinalizePricingButton_1.default, { orderId: order.id }) })] }));
}
