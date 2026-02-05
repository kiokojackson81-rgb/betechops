"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = ReturnsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const scope_1 = require("@/lib/scope");
const jumia_1 = require("@/lib/jobs/jumia");
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const AutoRefresh_1 = __importDefault(require("@/app/_components/AutoRefresh"));
exports.dynamic = "force-dynamic";
const PAGE_SIZE_DEFAULT = 10;
const RETURN_STATUSES = ["pickup_scheduled", "picked_up"];
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
function buildWhere(term) {
    const where = { status: { in: [...RETURN_STATUSES] } };
    if (!term)
        return where;
    return {
        ...where,
        OR: [
            { order: { is: { orderNumber: { contains: term } } } },
            { order: { is: { customerName: { contains: term } } } },
            { shop: { is: { name: { contains: term } } } },
        ],
    };
}
async function fetchReturns(where, page, size) {
    return await prisma_1.prisma.returnCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * size,
        take: size,
        include: {
            shop: { select: { name: true } },
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    customerName: true,
                    createdAt: true,
                    paidAmount: true,
                    items: {
                        select: {
                            quantity: true,
                            sellingPrice: true,
                            product: { select: { name: true, sku: true } },
                        },
                    },
                },
            },
        },
    });
}
async function ReturnsPage({ searchParams, }) {
    const params = await searchParams;
    const scope = await (0, scope_1.resolveShopScopeForServer)();
    const page = Math.max(1, Number(params?.page || 1));
    const size = Math.min(50, Math.max(1, Number(params?.size || PAGE_SIZE_DEFAULT)));
    const q = (params?.q || "").trim() || undefined;
    let syncError = null;
    try {
        await (0, jumia_1.syncReturnOrders)({ lookbackDays: 30 });
    }
    catch (e) {
        syncError = e instanceof Error ? e.message : String(e);
    }
    const whereBase = buildWhere(q);
    const where = scope.shopIds && scope.shopIds.length > 0
        ? { ...whereBase, shopId: { in: scope.shopIds } }
        : whereBase;
    let degraded = false;
    let total = 0;
    let rows = [];
    try {
        [total, rows] = await Promise.all([
            prisma_1.prisma.returnCase.count({ where }),
            fetchReturns(where, page, size),
        ]);
    }
    catch (e) {
        console.error("ReturnsPage DB error:", e);
        degraded = true;
    }
    const totalPages = Math.max(1, Math.ceil(total / size));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-7xl p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Returns - Waiting Pickup" }), (0, jsx_runtime_1.jsx)("p", { className: "text-slate-400 text-sm", children: "Vendor returns synced from Jumia. Mark them as picked once the parcel is collected." }), syncError && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-yellow-300/80", children: ["Sync degraded: ", syncError] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)(AutoRefresh_1.default, { storageKey: "autoRefreshReturns", intervalMs: 60000, defaultEnabled: true }), (0, jsx_runtime_1.jsxs)("form", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { name: "q", defaultValue: q || "", placeholder: "Search order #, customer, shop.", className: "rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:bg-white/10" }), (0, jsx_runtime_1.jsx)("select", { name: "size", defaultValue: String(size), className: "rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-sm", children: [10, 20, 30, 50].map((n) => ((0, jsx_runtime_1.jsxs)("option", { value: n, children: [n, "/page"] }, n))) }), (0, jsx_runtime_1.jsx)("button", { className: "rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10", children: "Apply" })] })] })] }), degraded && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "mt-0.5 h-5 w-5 shrink-0" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-medium", children: "Database is unavailable or misconfigured." }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm opacity-90", children: "Showing 0 results. Check DATABASE_URL and migrations. See Admin \u2192 Health Checks." })] })] })), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-2xl border border-white/10", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-white/5", children: (0, jsx_runtime_1.jsxs)("tr", { className: "[&>th]:px-3 [&>th]:py-2 text-left text-slate-300", children: [(0, jsx_runtime_1.jsx)("th", { children: "Order #" }), (0, jsx_runtime_1.jsx)("th", { children: "Customer" }), (0, jsx_runtime_1.jsx)("th", { children: "Shop" }), (0, jsx_runtime_1.jsx)("th", { children: "Items" }), (0, jsx_runtime_1.jsx)("th", { children: "Value" }), (0, jsx_runtime_1.jsx)("th", { children: "Status" }), (0, jsx_runtime_1.jsx)("th", { children: "Created" }), (0, jsx_runtime_1.jsx)("th", { className: "text-right", children: "Action" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { className: "divide-y divide-white/10", children: [rows.map((ret) => {
                                    const order = ret.order;
                                    const items = order?.items || [];
                                    const itemsCount = items.reduce((sum, it) => sum + it.quantity, 0);
                                    const value = items.reduce((sum, it) => sum + (Number(it.sellingPrice || 0) * it.quantity), 0);
                                    const picked = ret.status === "picked_up" || Boolean(ret.pickedAt);
                                    return ((0, jsx_runtime_1.jsxs)("tr", { className: "[&>td]:px-3 [&>td]:py-3", children: [(0, jsx_runtime_1.jsx)("td", { className: "font-mono", children: order?.orderNumber || "—" }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: order?.customerName || "—" }) }), (0, jsx_runtime_1.jsx)("td", { children: ret.shop?.name || "—" }), (0, jsx_runtime_1.jsx)("td", { children: itemsCount }), (0, jsx_runtime_1.jsx)("td", { children: fmtKsh(value) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("span", { className: `inline-flex rounded-full px-2 py-0.5 text-xs ${picked ? "bg-emerald-500/10 text-emerald-200" : "bg-orange-500/10 text-orange-200"}`, children: picked ? "Picked" : "Waiting pickup" }) }), (0, jsx_runtime_1.jsx)("td", { children: order?.createdAt ? fmtDate(order.createdAt) : fmtDate(ret.createdAt) }), (0, jsx_runtime_1.jsx)("td", { className: "text-right", children: (0, jsx_runtime_1.jsx)(link_1.default, { href: `/admin/returns/${ret.id}`, className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "View" }) })] }, ret.id));
                                }), rows.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 8, className: "px-3 py-8 text-center text-slate-400", children: "No returns found." }) }))] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex items-center justify-between text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Page ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: page }), " of", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: totalPages }), " \u2022 ", total, " total"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: `/admin/returns?${new URLSearchParams({
                                    q: q || "",
                                    size: String(size),
                                    page: String(Math.max(1, page - 1)),
                                }).toString()}`, className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Prev" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/admin/returns?${new URLSearchParams({
                                    q: q || "",
                                    size: String(size),
                                    page: String(Math.min(totalPages, page + 1)),
                                }).toString()}`, className: "rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10", children: "Next" })] })] })] }));
}
