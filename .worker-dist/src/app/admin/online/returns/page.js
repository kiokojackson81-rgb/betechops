"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminOnlineReturnsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const navigation_1 = require("next/navigation");
const MarketplaceDataFallback_1 = __importDefault(require("../_components/MarketplaceDataFallback"));
exports.dynamic = "force-dynamic";
const statusLabels = {
    WAITING_AT_HUB: "Waiting at hub",
    PICKED: "Picked",
    CHARGED_TO_ATTENDANT: "Charged to attendant",
};
async function AdminOnlineReturnsPage(props) {
    const searchParams = props?.searchParams;
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN" && role !== "SUPERVISOR") {
        return (0, navigation_1.redirect)("/not-authorized");
    }
    const rawStatus = searchParams?.status;
    const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
    const normalizedStatus = statusParam?.toUpperCase();
    const prismaStatusFilter = normalizedStatus && Object.keys(statusLabels).includes(normalizedStatus) ? normalizedStatus : undefined;
    const selectedStatus = prismaStatusFilter;
    let counts = null;
    let returns = null;
    try {
        const [groupCounts, returnEntries] = await Promise.all([
            prisma_1.prisma.marketplaceReturn.groupBy({
                by: ["status"],
                _count: { _all: true },
            }),
            prisma_1.prisma.marketplaceReturn.findMany({
                where: prismaStatusFilter ? { status: prismaStatusFilter } : undefined,
                include: {
                    account: { select: { displayName: true, platform: true } },
                    attendant: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 200,
            }),
        ]);
        counts = groupCounts;
        returns = returnEntries.map((entry) => ({
            id: entry.id,
            status: entry.status,
            orderItemId: entry.orderItemId,
            platform: entry.platform,
            dueAt: entry.dueAt,
            createdAt: entry.createdAt,
            expectedAmount: entry.expectedAmount,
            accountName: entry.account.displayName,
            accountPlatform: entry.account.platform,
            attendantName: entry.attendant?.name ?? null,
            attendantEmail: entry.attendant?.email ?? null,
        }));
    }
    catch (err) {
        console.error("Admin online returns failed to load data:", err);
    }
    if (!counts || !returns) {
        return ((0, jsx_runtime_1.jsx)(MarketplaceDataFallback_1.default, { title: "Marketplace returns unavailable", reason: "We could not query marketplace return groups or the most recent cases. Double-check that the online ops migrations ran successfully (MarketplaceReturn & related tables) before refreshing.", className: "mt-4" }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Returns" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-white", children: "Marketplace returns & deductions" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Track cases that still need action before nightly deductions kick in. Use the filters to focus on a specific status." })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: Object.entries(statusLabels).map(([statusKey, label]) => {
                    const status = statusKey;
                    const count = counts.find((entry) => entry.status === status)?._count._all ?? 0;
                    const isActive = selectedStatus === status;
                    const href = isActive ? "/admin/online/returns" : `/admin/online/returns?status=${status}`;
                    return ((0, jsx_runtime_1.jsxs)("a", { href: href, className: `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${isActive
                            ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                            : "border-white/15 text-slate-200 hover:border-emerald-400/60 hover:text-emerald-200"}`, children: [label, " (", count, ")"] }, status));
                }) }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/30", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full min-w-[720px] text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Return" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Account" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Attendant" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Expected amount" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Due date" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [returns.map((entry) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/5", children: [(0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: statusLabels[entry.status] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["Order item #", entry.orderItemId] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: entry.accountName }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400 capitalize", children: entry.accountPlatform.toLowerCase() })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-4", children: entry.attendantName || entry.attendantEmail ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: entry.attendantName ?? entry.attendantEmail ?? "Unassigned" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: entry.attendantEmail })] })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: "Unassigned" })) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-4 text-right font-semibold text-emerald-200", children: ["KES ", Number(entry.expectedAmount).toLocaleString()] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-4 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("div", { children: entry.dueAt.toLocaleDateString() }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["Created ", entry.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })] })] })] }, entry.id))), returns.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-6 text-center text-sm text-slate-400", colSpan: 5, children: "No return cases found for the selected filter." }) }))] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200", children: "Returns are sourced from the nightly Jumia sync job. Once supervisors approve a case and confirm pickup, use the attendant tooling to update the underlying order state so the deductions are reconciled automatically." })] }));
}
