"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminOnlineAccountsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const navigation_1 = require("next/navigation");
const AccountAdminPanel_1 = require("./AccountAdminPanel");
const MarketplaceDataFallback_1 = __importDefault(require("../_components/MarketplaceDataFallback"));
exports.dynamic = "force-dynamic";
async function AdminOnlineAccountsPage() {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN" && role !== "SUPERVISOR") {
        return (0, navigation_1.redirect)("/not-authorized");
    }
    const now = new Date();
    let rows = null;
    try {
        const accounts = (await prisma_1.prisma.marketplaceAccount.findMany({
            orderBy: [{ createdAt: "desc" }],
            include: {
                assignments: {
                    include: {
                        attendant: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                    where: {
                        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        }));
        rows = accounts.map((account) => ({
            id: account.id,
            displayName: account.displayName,
            platform: account.platform,
            countryCode: account.countryCode,
            currency: account.currency,
            jumiaShopSid: account.jumiaShopSid,
            kilimallShopCode: account.kilimallShopCode,
            isActive: account.isActive,
            assignments: account.assignments.map((assignment) => ({
                attendantId: assignment.attendant?.id ?? assignment.attendantId,
                attendantName: assignment.attendant?.name ?? null,
                attendantEmail: assignment.attendant?.email ?? null,
                role: assignment.role,
                endsAt: assignment.endsAt,
            })),
        }));
    }
    catch (err) {
        console.error("Admin online accounts failed to load data:", err);
    }
    if (!rows) {
        return ((0, jsx_runtime_1.jsx)(MarketplaceDataFallback_1.default, { title: "Marketplace accounts unavailable", reason: "We can't query marketplace accounts or assignments because the backing tables haven't been created yet." }));
    }
    let attendants = [];
    try {
        attendants = await prisma_1.prisma.user.findMany({
            where: {
                role: { in: ["ATTENDANT", "SUPERVISOR"] },
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                attendantCategory: true,
            },
            orderBy: [{ name: "asc" }, { email: "asc" }],
            take: 200,
        });
    }
    catch (err) {
        console.error("Admin online accounts failed to load attendant directory:", err);
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Accounts" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-white", children: "Marketplace account directory" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "View every configured Jumia / Kilimall account plus the attendants currently assigned via the API." })] }), (0, jsx_runtime_1.jsx)(AccountAdminPanel_1.AccountAdminPanel, { accounts: rows.map((row) => ({ id: row.id, displayName: row.displayName, platform: row.platform })), attendants: attendants }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/30", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full min-w-[640px] text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Account" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Platform" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Identifiers" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3", children: "Assignments" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [rows.map((row) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/5", children: [(0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: row.displayName }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [row.countryCode, " \u2022 ", row.currency, " \u2022 ", row.isActive ? "Active" : "Disabled"] })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-4 capitalize text-slate-200", children: row.platform.toLowerCase() }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-4 text-xs text-slate-300", children: [row.jumiaShopSid && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: "Shop SID:" }), " ", row.jumiaShopSid] })), row.kilimallShopCode && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: "Kilimall code:" }), " ", row.kilimallShopCode] })), !row.jumiaShopSid && !row.kilimallShopCode && (0, jsx_runtime_1.jsx)("div", { className: "text-slate-500", children: "\u2014" })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-4", children: [row.assignments.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-500", children: "No live assignments" })), (0, jsx_runtime_1.jsx)("ul", { className: "space-y-2", children: row.assignments.map((assignment) => ((0, jsx_runtime_1.jsxs)("li", { className: "text-xs text-slate-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: assignment.attendantName || assignment.attendantEmail || assignment.attendantId }), (0, jsx_runtime_1.jsxs)("div", { className: "text-slate-400", children: [assignment.role, assignment.endsAt ? ` • ends ${assignment.endsAt.toLocaleDateString()}` : ""] })] }, `${row.id}-${assignment.attendantId}`))) })] })] }, row.id))), rows.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-6 text-center text-sm text-slate-400", colSpan: 4, children: "No marketplace accounts have been created yet." }) }))] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-100", children: ["To create or update accounts programmatically, continue using the", " ", (0, jsx_runtime_1.jsx)("code", { className: "text-amber-200", children: "/api/admin/online/accounts" }), " endpoint. A full-featured UI editor is on the roadmap, but this view gives admins immediate visibility into the data flowing through the new pipelines."] })] }));
}
