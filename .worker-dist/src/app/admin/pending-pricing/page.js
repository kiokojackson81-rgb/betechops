"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PendingPricingPage;
const jsx_runtime_1 = require("react/jsx-runtime");
// src/app/admin/pending-pricing/page.tsx
const prisma_1 = require("@/lib/prisma");
const scope_1 = require("@/lib/scope");
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const PAGE_SIZE_DEFAULT = 10;
function fmtKsh(n) {
    return `Ksh ${n.toLocaleString()}`;
}
function fmtDate(d) {
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    }).format(d);
}
function buildWhere(q) {
    const base = { status: "PENDING" };
    if (!q)
        return base;
    return {
        ...base,
        OR: [
            { orderNumber: { contains: q } },
            { customerName: { contains: q } },
            { shop: { is: { name: { contains: q } } } },
        ],
    };
}
async function PendingPricingPage({ searchParams, }) {
    const params = await searchParams;
    const scope = await (0, scope_1.resolveShopScopeForServer)();
    const page = Math.max(1, Number(params?.page || 1));
    const size = Math.min(50, Math.max(1, Number(params?.size || PAGE_SIZE_DEFAULT)));
    const q = (params?.q || "").trim() || undefined;
    const whereBase = buildWhere(q);
    const where = (scope.shopIds && scope.shopIds.length > 0)
        ? ({ ...whereBase, shopId: { in: scope.shopIds } })
        : whereBase;
    let degraded = false;
    let total = 0;
    let rows = [];
    try {
        [total, rows] = await Promise.all([
            prisma_1.prisma.order.count({ where }),
            prisma_1.prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * size,
                take: size,
                include: {
                    shop: { select: { name: true } },
                    items: {
                        select: { quantity: true, sellingPrice: true, product: { select: { name: true, sku: true, sellingPrice: true } } },
                    },
                },
            }),
        ]);
    }
    catch (e) {
        console.error("PendingPricingPage DB error:", e);
        degraded = true;
    }
    const totalPages = Math.max(1, Math.ceil(total / size));
    // Compute derived totals
    const calcTotals = (items) => {
        const qty = items.reduce((n, it) => n + it.quantity, 0);
        // Compute subtotal from sellingPrice (item.sellingPrice || product.sellingPrice)
        const subtotal = items.reduce((sum, it) => {
            const item = it;
            const unit = (item.sellingPrice ?? item.product?.sellingPrice ?? 0);
            return sum + unit * item.quantity;
        }, 0);
        return { qty, subtotal };
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-7xl p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Pending Pricing" }), (0, jsx_runtime_1.jsx)("p", { className: "text-slate-400 text-sm", children: "Orders that need price verification or completion." })] }), (0, jsx_runtime_1.jsxs)("form", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { name: "q", defaultValue: q || "", placeholder: "Search order #, name, shop\u2026", className: "rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:bg-white/10" }), (0, jsx_runtime_1.jsx)("select", { name: "size", defaultValue: String(size), className: "rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-sm", children: [10, 20, 30, 50].map(n => (0, jsx_runtime_1.jsxs)("option", { value: n, children: [n, "/page"] }, n)) }), (0, jsx_runtime_1.jsx)("button", { className: "rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10", children: "Apply" })] })] }), degraded && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "mt-0.5 h-5 w-5 shrink-0" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-medium", children: "Database is unavailable or misconfigured." }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm opacity-90", children: "Showing 0 results. Check DATABASE_URL and migrations. See Admin \u2192 Health Checks." })] })] })), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-2xl border border-white/10", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/5", children: (0, jsx_runtime_1.jsxs)("tr", { className: "[&>th]:px-3 [&>th]:py-2 text-left text-slate-300", children: [(0, jsx_runtime_1.jsx)("th", { children: "Order #" }), (0, jsx_runtime_1.jsx)("th", { children: "Customer" }), (0, jsx_runtime_1.jsx)("th", { children: "Shop" }), (0, jsx_runtime_1.jsx)("th", { children: "Qty" }), (0, jsx_runtime_1.jsx)("th", { children: "Est. Total" }), (0, jsx_runtime_1.jsx)("th", { children: "Created" }), (0, jsx_runtime_1.jsx)("th", { className: "text-right", children: "Action" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { className: "divide-y divide-white/10", children: [rows.map((o) => {
                                    const order = o;
                                    const { qty, subtotal } = calcTotals(order.items);
                                    return ((0, jsx_runtime_1.jsxs)("tr", { className: "[&>td]:px-3 [&>td]:py-3", children: [(0, jsx_runtime_1.jsx)("td", { className: "font-mono", children: order.orderNumber }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: order.customerName }) }), (0, jsx_runtime_1.jsx)("td", { children: order.shop?.name || "—" }), (0, jsx_runtime_1.jsx)("td", { children: qty }), (0, jsx_runtime_1.jsx)("td", { children: fmtKsh(subtotal) }), (0, jsx_runtime_1.jsx)("td", { children: fmtDate(order.createdAt) }), (0, jsx_runtime_1.jsx)("td", { className: "text-right", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: `/admin/pending-pricing/${order.id}`, className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Review" }) })] }, order.id));
                                }), rows.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 7, className: "px-3 py-8 text-center text-slate-400", children: "Nothing pending pricing." }) }))] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex items-center justify-between text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Page ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: page }), " of ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: totalPages }), " \u2022 ", total, " total"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: `/admin/pending-pricing?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.max(1, page - 1)) }).toString()}`, className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Prev" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/admin/pending-pricing?${new URLSearchParams({ q: q || "", size: String(size), page: String(Math.min(totalPages, page + 1)) }).toString()}`, className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Next" })] })] })] }));
}
