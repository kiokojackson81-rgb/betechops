"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WeeklySummary;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
function fmt(n) {
    return `KES ${n.toLocaleString()}`;
}
async function WeeklySummary({ period }) {
    const activePeriod = period ?? (0, tradingPeriod_1.getJumiaWeeklyPeriodFor)(new Date());
    const start = activePeriod.start;
    const end = activePeriod.end;
    const agg = await prisma_1.prisma.marketplaceOrder.aggregate({
        where: { orderedAt: { gte: start, lte: end } },
        _count: true,
        _sum: {
            sellingPrice: true,
            sellerFee: true,
            shippingFee: true,
            profit: true,
        },
    });
    const count = agg._count ?? 0;
    const totalSales = Number(agg._sum.sellingPrice ?? 0);
    const totalFees = Number(agg._sum.sellerFee ?? 0);
    const totalShipping = Number(agg._sum.shippingFee ?? 0);
    const totalProfit = Number(agg._sum.profit ?? 0);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/40 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Marketplace (Jumia) \u2014 Weekly summary" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: activePeriod.label })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-right text-sm text-slate-300", children: (0, jsx_runtime_1.jsxs)("div", { children: ["Orders: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: count })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg bg-white/5 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Total sales" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-slate-100", children: fmt(totalSales) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg bg-white/5 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Seller fees" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-slate-100", children: fmt(totalFees) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg bg-white/5 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Shipping" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-slate-100", children: fmt(totalShipping) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg bg-white/5 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "Profit" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-medium text-emerald-400", children: fmt(totalProfit) })] })] })] }));
}
