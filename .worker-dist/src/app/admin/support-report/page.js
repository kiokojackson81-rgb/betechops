"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminSupportReportPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const navigation_1 = require("next/navigation");
const auth_1 = require("@/lib/auth");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const ClientSupportReport_1 = __importDefault(require("./ClientSupportReport"));
const prisma_1 = require("@/lib/prisma");
const marketingCommission_1 = require("@/lib/marketingCommission");
exports.dynamic = "force-dynamic";
async function AdminSupportReportPage({ searchParams, }) {
    const resolvedSearchParams = (await searchParams) ?? {};
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN") {
        return (0, navigation_1.redirect)("/not-authorized");
    }
    const basePeriod = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const fromParam = Array.isArray(resolvedSearchParams.from)
        ? resolvedSearchParams.from[0]
        : resolvedSearchParams.from;
    const toParam = Array.isArray(resolvedSearchParams.to)
        ? resolvedSearchParams.to[0]
        : resolvedSearchParams.to;
    const day = Array.isArray(resolvedSearchParams.day)
        ? resolvedSearchParams.day[0]
        : resolvedSearchParams.day ?? "";
    const attendantId = Array.isArray(resolvedSearchParams.attendantId)
        ? resolvedSearchParams.attendantId[0]
        : resolvedSearchParams.attendantId ?? "";
    const search = Array.isArray(resolvedSearchParams.search)
        ? resolvedSearchParams.search[0]
        : resolvedSearchParams.search ?? "";
    const fromDate = fromParam && !Number.isNaN(new Date(fromParam).getTime())
        ? fromParam
        : basePeriod.start.toISOString().split("T")[0];
    const toDate = toParam && !Number.isNaN(new Date(toParam).getTime())
        ? toParam
        : basePeriod.end.toISOString().split("T")[0];
    const query = new URLSearchParams();
    query.set("from", fromDate);
    query.set("to", toDate);
    if (day)
        query.set("day", day);
    if (attendantId)
        query.set("attendantId", attendantId);
    if (search)
        query.set("search", search);
    // Query the data directly on the server to avoid internal API fetch
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const where = {
        date: {
            gte: fromDateObj,
            lte: toDateObj,
        },
    };
    if (day)
        where.dayOfWeek = day;
    if (attendantId)
        where.submittedById = attendantId;
    if (search) {
        where.OR = [
            { submittedBy: { is: { name: { contains: search, mode: "insensitive" } } } },
            { submittedBy: { is: { email: { contains: search, mode: "insensitive" } } } },
        ];
    }
    const entries = await prisma_1.prisma.supportDailyEntry.findMany({
        where,
        include: { submittedBy: { select: { id: true, name: true, email: true } }, receipts: { include: { items: true } } },
        orderBy: { date: "desc" },
    });
    const mapped = entries.map((entry) => {
        const itemsSold = entry.receipts.reduce((sum, receipt) => sum + receipt.items.length, 0);
        const performanceEarnings = (entry.newBatteries + entry.changedBatteries) * 70;
        const commission = (0, marketingCommission_1.getCommissionSummaryForSales)(entry.totalSales).commission;
        return {
            id: entry.id,
            date: entry.date.toISOString().split("T")[0],
            dayOfWeek: entry.dayOfWeek,
            attendantId: entry.submittedById,
            attendantName: entry.submittedBy?.name ?? "Unknown",
            attendantEmail: entry.submittedBy?.email ?? null,
            totalSales: entry.totalSales,
            totalProfit: entry.totalProfit,
            itemsSold,
            receipts: entry.receipts.length,
            newBatteries: entry.newBatteries,
            changedBatteries: entry.changedBatteries,
            performanceEarnings,
            commission,
        };
    });
    const summary = mapped.reduce((acc, entry) => {
        acc.periodSales += entry.totalSales;
        acc.itemsSold += entry.itemsSold;
        acc.newBatteries += entry.newBatteries;
        acc.changedBatteries += entry.changedBatteries;
        acc.performanceEarnings += entry.performanceEarnings;
        acc.commission += entry.commission;
        acc.receipts += entry.receipts;
        return acc;
    }, {
        periodSales: 0,
        itemsSold: 0,
        newBatteries: 0,
        changedBatteries: 0,
        performanceEarnings: 0,
        commission: 0,
        receipts: 0,
    });
    const data = { periodLabel: `${fromDate} – ${toDate}`, entries: mapped, summary };
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsx)("main", { className: "mx-auto max-w-7xl p-6", children: (0, jsx_runtime_1.jsx)(ClientSupportReport_1.default, { periodLabel: data.periodLabel, entries: data.entries, summary: data.summary, initialFilters: { from: fromDate, to: toDate, day, attendantId, search } }) }) }));
}
