"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReportsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const definitions_1 = require("@/lib/attendants/definitions");
const reporting_1 = require("@/lib/attendants/reporting");
const prisma_1 = require("@/lib/prisma");
function formatDateRange(start, days) {
    const end = new Date(start);
    end.setDate(start.getDate() + days - 1);
    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${startStr} - ${endStr} (${days} days)`;
}
function formatCurrency(value) {
    return `KES ${new Intl.NumberFormat().format(Math.round(value))}`;
}
async function ReportsPage(props) {
    const searchParams = props?.searchParams ?? {};
    const isTrading = Boolean(searchParams?.trading);
    const days = searchParams?.days ? parseInt(searchParams.days, 10) || 7 : 7;
    const refDate = searchParams?.ref;
    const impersonateId = searchParams?.impersonateId;
    let impersonatedUser = null;
    if (impersonateId) {
        impersonatedUser = await prisma_1.prisma.user.findUnique({ where: { id: impersonateId }, select: { id: true, email: true, attendantCategory: true } });
    }
    const summary = isTrading
        ? await (0, reporting_1.getAttendantCategorySummary)({ tradingPeriod: true, refDate })
        : await (0, reporting_1.getAttendantCategorySummary)(days);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-6xl space-y-8 p-8 text-slate-100", children: [impersonatedUser && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-white/10 bg-yellow-900/5 p-3 text-sm text-yellow-200", children: ["Viewing as ", (0, jsx_runtime_1.jsx)("strong", { className: "text-white", children: impersonatedUser.email }), " \u2014 category: ", (0, jsx_runtime_1.jsx)("strong", { className: "text-white", children: impersonatedUser.attendantCategory ?? "Unassigned" })] })), (0, jsx_runtime_1.jsxs)("header", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Attendant Category Reports" }), (0, jsx_runtime_1.jsx)("p", { className: "text-slate-300", children: "Monitor how each attendant category is performing. These summaries combine direct activity logs (daily sales, product uploads) with live order queues." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "inline-flex rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-400", children: formatDateRange(summary.since, summary.days) }), (0, jsx_runtime_1.jsxs)("nav", { className: "inline-flex items-center gap-2 text-xs", children: [(0, jsx_runtime_1.jsxs)("a", { className: `rounded-md px-2 py-1 ${!isTrading ? "bg-white/5" : "bg-transparent"}`, href: `?days=${days}`, children: ["Last ", days, " days"] }), (0, jsx_runtime_1.jsx)("a", { className: `rounded-md px-2 py-1 ${isTrading ? "bg-white/5" : "bg-transparent"}`, href: `?trading=1${refDate ? `&ref=${encodeURIComponent(refDate)}` : ""}`, children: "Trading period (25th\u201324th)" })] })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid gap-6 md:grid-cols-2", children: definitions_1.attendantCategoryDefinitions
                    .filter((cat) => !impersonatedUser || cat.id === impersonatedUser.attendantCategory)
                    .map((cat) => {
                    const data = summary.categories[cat.id];
                    const dailySales = data?.metrics?.DAILY_SALES?.numericSum ?? 0;
                    const uploads = data?.metrics?.PRODUCT_UPLOADS?.intSum ?? 0;
                    const cardsBase = "rounded-2xl border border-white/10 bg-white/5 p-5 shadow";
                    return ((0, jsx_runtime_1.jsxs)("section", { className: cardsBase, children: [(0, jsx_runtime_1.jsxs)("header", { className: "mb-4 flex items-start justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: cat.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: cat.description })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300", children: [data?.users ?? 0, " attendant", (data?.users ?? 0) === 1 ? "" : "s"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 text-sm text-slate-200", children: [dailySales > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Logged daily sales" }), (0, jsx_runtime_1.jsx)("strong", { className: "text-emerald-200", children: formatCurrency(dailySales) })] })), uploads > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Products uploaded" }), (0, jsx_runtime_1.jsx)("strong", { className: "text-cyan-200", children: uploads })] })), data?.orderCounts ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-white/10 bg-black/20 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-widest text-slate-400", children: "Order pipeline" }), (0, jsx_runtime_1.jsx)("dl", { className: "mt-2 grid grid-cols-2 gap-2 text-xs", children: Object.entries(data.orderCounts).map(([status, count]) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col rounded bg-white/5 px-2 py-2", children: [(0, jsx_runtime_1.jsx)("dt", { className: "text-[10px] uppercase tracking-widest text-slate-400", children: status }), (0, jsx_runtime_1.jsx)("dd", { className: "text-base font-semibold text-white", children: String(count) })] }, status))) })] })) : null, (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-2", children: [
                                            ["newProducts", "New products"],
                                            ["productsEdited", "Products edited"],
                                            ["copiesUploaded", "Copies uploaded"],
                                            ["walkInServed", "Walk-ins served"],
                                            ["purchasesMade", "Purchases"],
                                            ["liveSessionsCount", "Live sessions"],
                                            ["commissionEarned", "Commission earned"],
                                            ["confirmedCompetitiveness", "Confirmed competitiveness"],
                                            ["promoVideos", "Promo videos"],
                                            ["demoVideos", "Demo videos"],
                                            ["engagementReplies", "Engagement replies"],
                                            ["allCommentsReplied", "All comments replied"],
                                        ].map(([metricKey, label]) => {
                                            const snake = String(metricKey).replace(/([A-Z])/g, "_$1").toUpperCase();
                                            const raw = data?.metrics?.[metricKey] ?? data?.metrics?.[snake];
                                            const val = raw ? (raw.numericSum ?? raw.intSum ?? 0) : 0;
                                            if (!val)
                                                return null;
                                            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded bg-white/5 px-2 py-2", children: [(0, jsx_runtime_1.jsx)("dt", { className: "text-[10px] uppercase tracking-widest text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("dd", { className: "text-sm font-semibold text-white", children: String(Math.round(val)) })] }, String(metricKey)));
                                        }) }), !dailySales && !uploads && !data?.orderCounts && Object.keys(data?.metrics ?? {}).length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500", children: "No tracked activity yet for this category." })), data?.concerns && data.concerns.count > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 rounded-lg border border-yellow-600/20 bg-yellow-900/5 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-widest text-yellow-300", children: "Concerns" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [data.concerns.count, " total"] }), (0, jsx_runtime_1.jsx)("ul", { className: "mt-2 space-y-1 text-sm", children: data.concerns.recent.slice(0, 3).map((c, i) => ((0, jsx_runtime_1.jsx)("li", { className: "rounded bg-white/3 px-2 py-1 text-slate-200", children: c }, i))) })] })] }))] })] }, cat.id));
                }) })] }));
}
