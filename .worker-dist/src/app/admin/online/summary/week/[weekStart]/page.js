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
const navigation_1 = require("next/navigation");
const currencyFormatter = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });
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
    const rows = await prisma_1.prisma.marketplacePayoutWeek.findMany({
        where: {
            account: { platform: client_1.Platform.JUMIA },
            weekStart: { lte: weekWindow.weekEnd },
            weekEnd: { gte: weekWindow.weekStart },
        },
        include: { account: true },
        orderBy: { payoutAmount: 'desc' },
    });
    if (!rows.length)
        return (0, jsx_runtime_1.jsx)("div", { className: "p-6", children: "No payout data for this week." });
    const rowsByAccount = new Map();
    for (const row of rows) {
        const bucket = rowsByAccount.get(row.accountId) ?? [];
        bucket.push(row);
        rowsByAccount.set(row.accountId, bucket);
    }
    const canonicalStart = weekWindow.weekStart;
    const chooseBestRow = (group) => {
        let best = null;
        for (const candidate of group) {
            const rowStart = (0, weekWindow_1.canonicalNairobiWeekStartUtc)(new Date(candidate.weekStart));
            const diff = Math.abs(rowStart.getTime() - canonicalStart.getTime());
            const payload = candidate.rawPayload;
            const periodStart = (0, weekWindow_1.parseDateOnlyUtc)(payload?.period?.startDate ?? null);
            const periodMatch = periodStart ? (0, weekWindow_1.canonicalNairobiWeekStartUtc)(periodStart).getTime() === canonicalStart.getTime() : false;
            const normalizedNumber = String(candidate.statementNumber ?? "").toUpperCase();
            const hasSuffix = /(OPEN|PAID|UNPAID)$/.test(normalizedNumber);
            const updatedScore = (candidate.updatedAt?.getTime() ?? 0) / 1000000;
            const score = (periodMatch ? 100 : 0) - diff + (hasSuffix ? 10 : 0) + updatedScore;
            if (!best || score > best.score) {
                best = { row: candidate, score };
            }
        }
        return best?.row ?? group[0];
    };
    const dedupedRows = Array.from(rowsByAccount.values()).map((group) => chooseBestRow(group));
    dedupedRows.sort((a, b) => (Number(b.payoutAmount ?? b.grossSales ?? 0) - Number(a.payoutAmount ?? a.grossSales ?? 0)));
    const weekLabel = `${(0, weekWindow_1.formatNairobiDate)(weekWindow.weekStart)} - ${(0, weekWindow_1.formatNairobiDate)(weekWindow.weekEnd)}`;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 p-6", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-semibold", children: ["Payout week: ", weekLabel] }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-white/10 bg-slate-900/40 p-4", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-left text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4", children: "Account" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4", children: "Statement" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4 text-right", children: "Payout" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 pr-4 text-right", children: "Gross sales" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: dedupedRows.map((row) => {
                                const statusInfo = (0, statementStatus_1.deriveStatementStatus)(row.statementNumber, row.isPaid);
                                const statusColor = statusInfo.label === 'OPEN'
                                    ? 'text-sky-300'
                                    : statusInfo.label === 'PAID'
                                        ? 'text-green-400'
                                        : 'text-yellow-300';
                                return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/5", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 font-medium text-white", children: row.account?.displayName ?? row.accountId }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-slate-200", children: row.statementNumber ?? '—' }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4", children: (0, jsx_runtime_1.jsx)("span", { className: statusColor, children: statusInfo.label }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-right text-emerald-200", children: currencyFormatter.format(Number(row.payoutAmount ?? row.grossSales ?? 0)) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 pr-4 text-right text-white", children: currencyFormatter.format(Number(row.grossSales ?? 0)) })] }, row.id));
                            }) })] }) })] }));
}
