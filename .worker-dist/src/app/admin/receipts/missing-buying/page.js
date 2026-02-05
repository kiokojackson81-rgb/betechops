"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const api_1 = require("@/lib/api");
exports.dynamic = "force-dynamic";
async function Page({ searchParams }) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok) {
        // Server-side redirect for unauthorized users to match other admin pages
        (0, navigation_1.redirect)("/admin/login");
    }
    const attendantId = searchParams?.attendantId ?? null;
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const start = period.start;
    const end = period.end;
    if (!attendantId) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold", children: "Missing buying prices" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500", children: "Please provide an `attendantId` query param to filter results." })] }));
    }
    const receipts = await prisma_1.prisma.order.findMany({
        where: { attendantId, createdAt: { gte: start, lte: end } },
        select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            totalAmount: true,
            items: {
                select: {
                    id: true,
                    productId: true,
                    quantity: true,
                    sellingPrice: true,
                    orderCosts: { select: { unitCost: true } },
                    profitSnapshots: { select: { unitCost: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    const missing = receipts
        .map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        createdAt: r.createdAt,
        sellingTotal: r.totalAmount,
        items: r.items.filter((it) => {
            const hasCost = (it.orderCosts && it.orderCosts.length > 0) || (it.profitSnapshots && it.profitSnapshots.length > 0);
            return !hasCost;
        }),
    }))
        .filter((r) => (r.items?.length ?? 0) > 0);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Receipts missing buying prices" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-500 mb-4", children: ["Period: ", period.label, ". Attendant: ", attendantId] }), missing.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "text-slate-400", children: "No receipts with missing buying prices for this attendant/period." })) : ((0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm border-collapse", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-slate-500 text-xs", children: [(0, jsx_runtime_1.jsx)("th", { className: "pb-2", children: "Receipt" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-2", children: "Created" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-2", children: "Selling" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-2", children: "Missing items" }), (0, jsx_runtime_1.jsx)("th", { className: "pb-2", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: missing.map((r) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-slate-800", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-2", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: `/receipts/${r.id}`, className: "underline text-slate-100", children: r.orderNumber ?? r.id }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 text-slate-400", children: new Date(r.createdAt).toLocaleString() }), (0, jsx_runtime_1.jsxs)("td", { className: "py-2", children: ["KES ", Number(r.sellingTotal ?? 0).toLocaleString()] }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 text-sm text-slate-200", children: r.items.map((it) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { children: it.productId ?? it.id }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["qty ", it.quantity ?? 1] })] }, it.id))) }), (0, jsx_runtime_1.jsx)("td", { className: "py-2", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: `/receipts/${r.id}`, className: "rounded border px-2 py-1 text-xs", children: "Edit prices" }) })] }, r.id))) })] }))] }));
}
