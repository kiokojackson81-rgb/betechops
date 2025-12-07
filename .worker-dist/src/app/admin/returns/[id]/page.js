"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReturnDetailPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const link_1 = __importDefault(require("next/link"));
const ActionMarkPicked_1 = __importDefault(require("./_actions/ActionMarkPicked"));
function fmtKsh(n) {
    return `Ksh ${n.toLocaleString()}`;
}
function fmtDate(d) {
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}
function statusLabel(status, pickedAt) {
    if (status === "picked_up" || pickedAt)
        return "Picked up";
    if (status === "pickup_scheduled")
        return "Waiting pickup";
    return status.replace(/_/g, " ");
}
async function ReturnDetailPage({ params }) {
    const { id } = await params;
    const ret = await prisma_1.prisma.returnCase.findUnique({
        where: { id },
        include: {
            shop: { select: { name: true, location: true } },
            order: {
                include: {
                    shop: { select: { name: true, location: true } },
                    attendant: { select: { name: true, email: true } },
                    items: {
                        select: {
                            id: true,
                            quantity: true,
                            sellingPrice: true,
                            product: { select: { name: true, sku: true, sellingPrice: true, lastBuyingPrice: true } },
                        },
                    },
                },
            },
        },
    });
    if (!ret || !ret.order) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-4xl p-6", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-slate-300", children: "Return not found." }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/returns", className: "mt-4 inline-block rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Back" })] }));
    }
    const order = ret.order;
    const qty = order.items.reduce((n, it) => n + it.quantity, 0);
    const total = order.items.reduce((sum, it) => sum + ((it.sellingPrice ?? it.product?.sellingPrice ?? 0) * it.quantity), 0);
    const cost = order.items.reduce((sum, it) => sum + ((it.product?.lastBuyingPrice ?? 0) * it.quantity), 0);
    const gross = total - cost;
    const picked = ret.status === "picked_up" || Boolean(ret.pickedAt);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-5xl p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-4 flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-2xl font-semibold", children: ["Return \u2022 ", order.orderNumber || ret.id] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-slate-400 text-sm", children: [statusLabel(ret.status, ret.pickedAt), " \u2022 Created ", fmtDate(ret.createdAt)] })] }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/admin/returns", className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Back" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Customer" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium", children: order.customerName || "—" }), (0, jsx_runtime_1.jsx)("div", { className: "text-slate-400 text-sm", children: order.customerName || "—" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Shop" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium", children: ret.shop?.name || order.shop?.name || "—" }), (0, jsx_runtime_1.jsx)("div", { className: "text-slate-400 text-sm", children: ret.shop?.location || order.shop?.location || "—" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Attendant" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium", children: order.attendant?.name || "—" }), (0, jsx_runtime_1.jsx)("div", { className: "text-slate-400 text-sm", children: order.attendant?.email || "—" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 overflow-x-auto rounded-2xl border border-white/10", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/5", children: (0, jsx_runtime_1.jsxs)("tr", { className: "[&>th]:px-3 [&>th]:py-2 text-left text-slate-300", children: [(0, jsx_runtime_1.jsx)("th", { children: "Product" }), (0, jsx_runtime_1.jsx)("th", { children: "SKU" }), (0, jsx_runtime_1.jsx)("th", { children: "Qty" }), (0, jsx_runtime_1.jsx)("th", { children: "Unit" }), (0, jsx_runtime_1.jsx)("th", { children: "Subtotal" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { className: "divide-y divide-white/10", children: [order.items.map((it) => {
                                    const unit = it.sellingPrice ?? it.product?.sellingPrice ?? 0;
                                    const sub = unit * it.quantity;
                                    return ((0, jsx_runtime_1.jsxs)("tr", { className: "[&>td]:px-3 [&>td]:py-2", children: [(0, jsx_runtime_1.jsx)("td", { children: it.product?.name || "—" }), (0, jsx_runtime_1.jsx)("td", { className: "font-mono", children: it.product?.sku || "—" }), (0, jsx_runtime_1.jsx)("td", { children: it.quantity }), (0, jsx_runtime_1.jsx)("td", { children: fmtKsh(unit) }), (0, jsx_runtime_1.jsx)("td", { children: fmtKsh(sub) })] }, it.id));
                                }), order.items.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 5, className: "px-3 py-8 text-center text-slate-400", children: "No items." }) }))] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Items" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-2xl font-semibold", children: qty })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Total" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-2xl font-semibold", children: fmtKsh(total) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Gross Profit" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-2xl font-semibold", children: fmtKsh(gross) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 flex gap-3", children: (0, jsx_runtime_1.jsx)(ActionMarkPicked_1.default, { returnId: ret.id, disabled: picked }) })] }));
}
