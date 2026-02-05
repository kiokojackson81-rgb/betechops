"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = WeekDetailPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const client_1 = require("@prisma/client");
const weekWindow_1 = require("@/lib/weekWindow");
const statementStatus_1 = require("@/lib/statementStatus");
const payoutWeekDedupe_1 = require("@/lib/payoutWeekDedupe");
const navigation_1 = require("next/navigation");
const currencyFormatter = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
});
exports.dynamic = 'force-dynamic';
async function WeekDetailPage({ params }) {
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPERVISOR')
        return (0, navigation_1.redirect)('/not-authorized');
    const rawParam = params.weekStart ?? '';
    const weekStart = (0, weekWindow_1.normalizeWeekStartFromParam)(rawParam);
    if (!weekStart)
        return (0, jsx_runtime_1.jsx)("div", { children: "Invalid week" });
    // find payout weeks matching this weekStart
    const weekWindow = (0, weekWindow_1.mondayToSundayNairobiWindow)(weekStart);
    const allAccounts = await prisma_1.prisma.marketplaceAccount.findMany({
        where: { platform: client_1.Platform.JUMIA, isActive: true },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
    });
    const rows = await prisma_1.prisma.marketplacePayoutWeek.findMany({
        where: {
            account: { platform: client_1.Platform.JUMIA },
            weekStart: { lte: weekWindow.weekEnd },
            weekEnd: { gte: weekWindow.weekStart },
        },
        include: { account: true },
        orderBy: { payoutAmount: 'desc' },
    });
    const rowsByAccount = new Map();
    for (const row of rows) {
        const bucket = rowsByAccount.get(row.accountId) ?? [];
        bucket.push(row);
        rowsByAccount.set(row.accountId, bucket);
    }
    const canonicalStart = weekWindow.weekStart;
    const displayRows = allAccounts.map((acct) => {
        const bucket = rowsByAccount.get(acct.id) ?? [];
        const row = (0, payoutWeekDedupe_1.chooseAuthoritativeCandidate)(bucket, canonicalStart);
        if (!row) {
            return {
                accountId: acct.id,
                accountName: acct.displayName ?? acct.id,
                statementNumber: null,
                statusLabel: 'NO STATEMENT',
                statusColor: 'text-amber-200',
                payout: 0,
                gross: 0,
            };
        }
        const statusInfo = (0, statementStatus_1.deriveStatementStatus)(row.statementNumber, row.isPaid);
        const statusColor = statusInfo.label === 'OPEN'
            ? 'text-sky-300'
            : statusInfo.label === 'PAID'
                ? 'text-green-400'
                : 'text-yellow-300';
        return {
            accountId: acct.id,
            accountName: acct.displayName ?? row.account?.displayName ?? acct.id,
            statementNumber: row.statementNumber ?? null,
            statusLabel: statusInfo.label,
            statusColor,
            payout: Number(row.payoutAmount ?? row.grossSales ?? 0),
            gross: Number(row.grossSales ?? 0),
            rowId: row.id,
        };
    });
    displayRows.sort((a, b) => b.payout - a.payout);
    const missingCount = displayRows.filter((row) => row.statusLabel === 'NO STATEMENT').length;
    const weekLabel = `${(0, weekWindow_1.formatNairobiDate)(weekWindow.weekStart)} - ${(0, weekWindow_1.formatNairobiDate)(weekWindow.weekEnd)}`;
    const totalPayout = displayRows.reduce((sum, row) => sum + row.payout, 0);
    const totalGross = displayRows.reduce((sum, row) => sum + row.gross, 0);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-semibold", children: ["Payout week: ", weekLabel] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-300", children: ["Accounts: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-white", children: displayRows.length }), missingCount > 0 ? ((0, jsx_runtime_1.jsxs)("span", { className: "ml-2 text-amber-200", children: ["Missing statements: ", missingCount] })) : ((0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-emerald-200", children: "All statements present" }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-400", children: ["Total payout: ", (0, jsx_runtime_1.jsx)("span", { className: "text-emerald-200", children: currencyFormatter.format(totalPayout) }), ' ', (0, jsx_runtime_1.jsx)("span", { className: "mx-2", children: "\u2022" }), "Total gross: ", (0, jsx_runtime_1.jsx)("span", { className: "text-white", children: currencyFormatter.format(totalGross) })] })] }), missingCount > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100", children: "Some accounts aren't yet backed by a statement row for this week. This usually means the Vendor Center hasn't published a payout in the canonical Nairobi week window yet." })), (0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-white/10 bg-slate-900/40 p-4", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4", children: "Account" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4", children: "Statement" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4 text-right", children: "Payout" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4 text-right", children: "Gross sales" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: displayRows.map((row) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/5", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 font-medium text-white", children: row.accountName }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-slate-200", children: row.statementNumber ?? '—' }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4", children: (0, jsx_runtime_1.jsx)("span", { className: row.statusColor, children: row.statusLabel }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-right text-emerald-200", children: currencyFormatter.format(row.payout) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-right text-white", children: currencyFormatter.format(row.gross) })] }, row.rowId ?? row.accountId))) })] }) })] }));
}
