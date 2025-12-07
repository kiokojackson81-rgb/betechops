"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MarketplaceDataFallback;
const jsx_runtime_1 = require("react/jsx-runtime");
const missingTables = [
    "MarketplaceAccount",
    "MarketplaceAccountAssignment",
    "MarketplacePayoutWeek",
    "MarketplaceOrder",
    "MarketplaceReturn",
];
function MarketplaceDataFallback({ title = "Marketplace data not initialized", className = "", reason = "The marketplace tables introduced in the online ops release are missing in this environment, so Prisma can't return any metrics.", }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: `rounded-3xl border border-rose-500/30 bg-rose-500/5 px-6 py-6 text-rose-100 shadow-lg shadow-black/30 ${className}`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-rose-300", children: "Online ops" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-semibold text-white", children: title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-rose-100/90", children: reason })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 rounded-2xl border border-rose-500/40 bg-black/40 p-4 text-sm text-rose-100/90", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-rose-100", children: "How to unblock" }), (0, jsx_runtime_1.jsxs)("ol", { className: "mt-2 list-decimal space-y-2 pl-5", children: [(0, jsx_runtime_1.jsxs)("li", { children: ["Deploy the pending Prisma migrations to your production database:", (0, jsx_runtime_1.jsx)("code", { className: "ml-2 rounded bg-black/40 px-2 py-0.5 text-xs text-rose-200", children: "pnpm prisma migrate deploy" })] }), (0, jsx_runtime_1.jsxs)("li", { children: ["Confirm the marketplace tables exist (", missingTables.join(", "), ") via your SQL client or", " ", (0, jsx_runtime_1.jsx)("code", { className: "text-rose-200", children: "SELECT" }), " statements."] }), (0, jsx_runtime_1.jsx)("li", { children: "Rerun the online sync job (or wait for the nightly run) so the new tables are populated, then refresh this page." })] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-3 text-xs text-rose-200/80", children: ["These steps ensure Prisma can query the online ops data without failing migrations like", " ", (0, jsx_runtime_1.jsx)("code", { className: "text-rose-100", children: "20251205_guard_weekly_attendant_fix" }), "."] })] })] }));
}
