"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminDashboard;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const lucide_react_1 = require("lucide-react");
// Opt out of prerendering; this page hits the DB
exports.dynamic = "force-dynamic";
async function getStats() {
    try {
        const [products, shops, attendants, orders, revenueAgg] = await Promise.all([
            prisma_1.prisma.product.count(),
            prisma_1.prisma.shop.count(),
            prisma_1.prisma.user.count({ where: { role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] } } }),
            prisma_1.prisma.order.count(),
            prisma_1.prisma.order.aggregate({ _sum: { paidAmount: true } }),
        ]);
        return {
            products,
            shops,
            attendants,
            orders,
            revenue: revenueAgg._sum.paidAmount ?? 0,
        };
    }
    catch (e) {
        // Graceful fallback when DB is unavailable/misconfigured
        console.error("Admin dashboard getStats failed:", e);
        return {
            products: 0,
            shops: 0,
            attendants: 0,
            orders: 0,
            revenue: 0,
            // mark that data is degraded
            _degraded: true,
        };
    }
}
function StatCard(props) {
    const { title, value, Icon, sub } = props;
    return ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-white/10 bg-[var(--card,#23272f)] p-5", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-white/10 bg-white/5 p-2", children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-slate-400 text-sm", children: title }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold", children: value }), sub ? (0, jsx_runtime_1.jsx)("p", { className: "text-slate-400 text-xs mt-1", children: sub }) : null] })] }) }));
}
async function AdminDashboard() {
    const stats = await getStats();
    const { products, shops, attendants, orders, revenue } = stats;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-8 max-w-6xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl md:text-3xl font-bold", children: "Admin Dashboard" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-slate-300", children: "Live metrics from your Prisma database." }), "_degraded" in stats && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "mt-0.5 h-5 w-5 shrink-0" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-medium", children: "Database is unavailable or misconfigured." }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm opacity-90", children: "Counts are shown as 0 for now. Verify DATABASE_URL and run migrations. See Admin \u2192 Health Checks." })] })] }))] }), (0, jsx_runtime_1.jsxs)("section", { className: "grid md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsx)(StatCard, { title: "Products", value: products, Icon: lucide_react_1.Package }), (0, jsx_runtime_1.jsx)(StatCard, { title: "Shops", value: shops, Icon: lucide_react_1.Store }), (0, jsx_runtime_1.jsx)(StatCard, { title: "Attendants", value: attendants, Icon: lucide_react_1.Users }), (0, jsx_runtime_1.jsx)(StatCard, { title: "Orders", value: orders, Icon: lucide_react_1.Receipt }), (0, jsx_runtime_1.jsx)(StatCard, { title: "Revenue (paid)", value: `Ksh ${revenue.toLocaleString()}`, Icon: lucide_react_1.Wallet, sub: "Sum of paid amounts" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-8 text-sm text-slate-400 space-y-1", children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Tip: seed more data with ", (0, jsx_runtime_1.jsx)("code", { className: "bg-white/10 px-1 py-0.5 rounded", children: "npm run prisma:seed" }), " and refresh."] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Troubleshooting: visit ", (0, jsx_runtime_1.jsx)("a", { className: "underline", href: "/admin/health-checks", children: "Admin \u2192 Health Checks" }), " to verify DB and OIDC."] })] })] }));
}
