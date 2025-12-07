"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminOnlineSummaryPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const client_1 = require("@prisma/client");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const navigation_1 = require("next/navigation");
exports.dynamic = "force-dynamic";
const currencyFormatter = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-KE");
const makeEmptyPayoutAgg = () => ({
    _sum: { grossSales: new client_1.Prisma.Decimal(0), payoutAmount: new client_1.Prisma.Decimal(0) },
    _count: { _all: 0 },
});
const makeEmptyOrdersAgg = () => ({
    _sum: { sellingPrice: new client_1.Prisma.Decimal(0) },
    _count: { _all: 0 },
});
async function AdminOnlineSummaryPage() {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN" && role !== "SUPERVISOR") {
        return (0, navigation_1.redirect)("/not-authorized");
    }
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const now = new Date();
    const warnings = [];
    const safe = async (label, fallback, fn) => {
        try {
            return await fn();
        }
        catch (err) {
            console.error(`[admin/online/summary] Failed to load ${label}:`, err);
            warnings.push(label);
            return fallback();
        }
    };
    const [accountCount, activeAssignments, payoutAgg, ordersAgg, unpricedOrders, returnsOpen, returnsByStatusRaw,] = await Promise.all([
        safe("account count", () => 0, () => prisma_1.prisma.marketplaceAccount.count()),
        safe("assignment count", () => 0, () => prisma_1.prisma.marketplaceAccountAssignment.count({
            where: {
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            },
        })),
        safe("payout stats", makeEmptyPayoutAgg, () => prisma_1.prisma.marketplacePayoutWeek.aggregate({
            _sum: { grossSales: true, payoutAmount: true },
            _count: { _all: true },
            where: {
                weekEnd: {
                    gte: period.start,
                    lte: period.end,
                },
            },
        })),
        safe("order stats", makeEmptyOrdersAgg, () => prisma_1.prisma.marketplaceOrder.aggregate({
            _count: { _all: true },
            _sum: { sellingPrice: true },
            where: {
                orderedAt: {
                    gte: period.start,
                    lte: period.end,
                },
            },
        })),
        safe("unpriced orders count", () => 0, () => prisma_1.prisma.marketplaceOrder.count({ where: { buyingPrice: null } })),
        safe("pending returns count", () => 0, () => prisma_1.prisma.marketplaceReturn.count({ where: { status: "WAITING_AT_HUB" } })),
        safe("returns grouped by status", () => [], async () => {
            const data = await prisma_1.prisma.marketplaceReturn.groupBy({
                by: ["status"],
                _count: { _all: true },
            });
            return data.map((entry) => ({
                status: entry.status,
                _count: { _all: entry._count._all },
            }));
        }),
    ]);
    const returnsByStatus = returnsByStatusRaw;
    const ordersCount = ordersAgg._count && typeof ordersAgg._count !== "boolean"
        ? ordersAgg._count._all ?? 0
        : 0;
    const payoutStatementCount = payoutAgg._count && typeof payoutAgg._count !== "boolean"
        ? payoutAgg._count._all ?? 0
        : 0;
    const cards = [
        { label: "Active accounts", value: accountCount },
        { label: "Active assignments", value: activeAssignments },
        {
            label: "Marketplace gross sales (period)",
            value: currencyFormatter.format(Number(payoutAgg._sum?.grossSales ?? 0)),
        },
        {
            label: "Orders synced (period)",
            value: numberFormatter.format(ordersCount),
        },
        { label: "Unpriced orders", value: unpricedOrders },
        { label: "Returns waiting at hub", value: returnsOpen },
    ];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-8", children: [warnings.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold", children: "Some marketplace metrics are unavailable right now." }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-sm text-amber-200", children: [warnings.join(", "), ". This usually means the latest database migrations haven't been applied yet or the nightly sync job hasn't populated data for this environment. Other metrics are still shown below."] })] })), (0, jsx_runtime_1.jsxs)("section", { children: [(0, jsx_runtime_1.jsxs)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Current trading period \u2022 ", period.label] }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold mt-1", children: "Operational snapshot" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: cards.map((card) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 shadow-inner shadow-black/40", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: card.label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-2xl font-semibold text-white", children: card.value })] }, card.label))) })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-slate-900/40 p-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: "Marketplace payout weeks" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: [payoutStatementCount, " statements synced between ", period.start.toLocaleDateString(), " and", " ", period.end.toLocaleDateString(), "."] })] }) }), (0, jsx_runtime_1.jsxs)("dl", { className: "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4", children: [(0, jsx_runtime_1.jsx)("dt", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Gross sales" }), (0, jsx_runtime_1.jsx)("dd", { className: "mt-2 text-xl font-semibold text-emerald-300", children: currencyFormatter.format(Number(payoutAgg._sum?.grossSales ?? 0)) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4", children: [(0, jsx_runtime_1.jsx)("dt", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Payout amounts" }), (0, jsx_runtime_1.jsx)("dd", { className: "mt-2 text-xl font-semibold text-emerald-300", children: currencyFormatter.format(Number(payoutAgg._sum?.payoutAmount ?? 0)) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4", children: [(0, jsx_runtime_1.jsx)("dt", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Statements counted" }), (0, jsx_runtime_1.jsx)("dd", { className: "mt-2 text-xl font-semibold text-white", children: numberFormatter.format(payoutStatementCount) })] })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-slate-900/40 p-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: "Return cases by status" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Live snapshot of marketplace return cases and their current status groupings." })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full min-w-[320px] text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4 text-right", children: "Cases" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [returnsByStatus.map((entry) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/5", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 font-medium text-white", children: entry.status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-right text-emerald-200", children: numberFormatter.format(entry._count._all) })] }, entry.status))), !returnsByStatus.length && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-slate-400", colSpan: 2, children: "No return cases available." }) }))] })] }) })] })] }));
}
