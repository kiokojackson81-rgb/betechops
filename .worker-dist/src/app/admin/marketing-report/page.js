"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const date_fns_1 = require("date-fns");
const ClientAdminMarketingReport_1 = __importDefault(require("./ClientAdminMarketingReport"));
const marketingReport_1 = require("@/lib/marketingReport");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const auth_1 = require("@/lib/auth");
const navigation_1 = require("next/navigation");
const getFirstParam = (value) => {
    if (!value)
        return "";
    return Array.isArray(value) ? value[0] ?? "" : value;
};
const AdminMarketingReportPage = async ({ searchParams }) => {
    // server-side guard: only ADMIN may access this page
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN")
        return (0, navigation_1.redirect)("/not-authorized");
    const periods = (0, tradingPeriod_1.getRecentTradingPeriods)(12);
    const selectedPeriodKey = getFirstParam(searchParams?.period);
    const selectedPeriod = periods.find((period) => period.key === selectedPeriodKey) ?? (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const dow = getFirstParam(searchParams?.dow);
    const dateStrRaw = getFirstParam(searchParams?.date);
    const userSearch = getFirstParam(searchParams?.user);
    const parsedDate = dateStrRaw ? new Date(dateStrRaw) : undefined;
    const validDate = parsedDate && !Number.isNaN(parsedDate.getTime());
    const from = validDate ? (0, date_fns_1.startOfDay)(parsedDate) : undefined;
    const to = validDate ? (0, date_fns_1.endOfDay)(parsedDate) : undefined;
    const report = await (0, marketingReport_1.getMarketingReport)({
        tradingPeriodKey: selectedPeriod.key,
        dayOfWeek: dow || undefined,
        from,
        to,
        userFilter: userSearch || undefined,
    });
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsx)("main", { className: "mx-auto max-w-7xl p-6", children: (0, jsx_runtime_1.jsx)(ClientAdminMarketingReport_1.default, { entries: report.entries, aggregates: report.aggregates, selectedPeriodKey: selectedPeriod.key, dow: dow, dateStr: validDate && dateStrRaw ? dateStrRaw : "", userFilter: userSearch ?? "" }) }) }));
};
exports.default = AdminMarketingReportPage;
exports.dynamic = "force-dynamic";
