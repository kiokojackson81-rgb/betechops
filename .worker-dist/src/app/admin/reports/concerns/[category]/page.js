"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CategoryConcernsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const definitions_1 = require("@/lib/attendants/definitions");
async function CategoryConcernsPage(props) {
    const params = props?.params ?? {};
    const catId = params.category;
    const catDef = definitions_1.attendantCategoryDefinitions.find((c) => c.id === catId);
    if (!catDef) {
        return (0, jsx_runtime_1.jsxs)("div", { className: "p-8 text-slate-200", children: ["Unknown category: ", catId] });
    }
    // fetch recent concerns for this category (90 days)
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const rows = await prisma_1.prisma.dailyReport.findMany({
        where: { date: { gte: since }, concerns: { not: null }, user: { attendantCategory: catId } },
        select: { concerns: true, date: true, user: { select: { name: true, email: true } }, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
    });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-4xl p-8 text-slate-100", children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-6", children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-2xl font-semibold", children: ["Concerns \u2014 ", catDef.label] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["Showing recent concerns (last 90 days). Total: ", rows.length] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [rows.map((r) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-white/10 bg-white/3 p-4 text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [new Date(r.date).toLocaleDateString(), " \u2014 ", r.user?.name ?? r.user?.email ?? "Unknown"] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 whitespace-pre-wrap", children: String(r.concerns) })] }, String(r.createdAt)))), rows.length === 0 && (0, jsx_runtime_1.jsx)("div", { className: "text-slate-400", children: "No concerns found for this category." })] })] }));
}
