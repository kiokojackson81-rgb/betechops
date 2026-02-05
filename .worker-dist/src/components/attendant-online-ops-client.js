"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantOnlineOpsClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const ReceiptsEditor_1 = __importDefault(require("@/app/_components/ReceiptsEditor"));
const toast_1 = require("@/lib/ui/toast");
const QuickStatsCard_1 = __importDefault(require("@/components/QuickStatsCard"));
const EarningsCard_1 = __importDefault(require("@/app/_components/EarningsCard"));
const PayrollTableClient_1 = __importDefault(require("@/app/admin/payroll/PayrollTableClient"));
const payrollMapping_1 = require("@/lib/payrollMapping");
const MARKETPLACE_ANCHOR_START = new Date("2025-11-24T00:00:00+03:00");
const randomId = () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const createItem = () => ({ id: randomId(), productName: "", buyingPrice: "" });
const createReceipt = () => ({
    id: randomId(),
    receiptNumber: "",
    sellingTotal: "",
    paymentMethod: "",
    items: [createItem()],
});
const formatKES = (value) => `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const formatNairobiParam = (date, endOfDay = false) => {
    const ymd = date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
    return endOfDay ? `${ymd}T23:59:59.999+03:00` : `${ymd}T00:00:00+03:00`;
};
function startOfWeekMonday(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diffToMonday);
    copy.setHours(0, 0, 0, 0);
    return copy;
}
function endOfWeekSunday(start) {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}
function formatWeekLabel(start, end) {
    const fmt = (value) => value.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    return `${fmt(start)} - ${fmt(end)}`;
}
const MARKETPLACE_STEP_POINTS = [
    2000000,
    3000000,
    4000000,
    5000000,
    6000000,
    7000000,
    8000000,
    9000000,
    10000000,
];
const clamp01 = (value) => Math.max(0, Math.min(1, value));
function describeMarketplaceTier(sales) {
    const normalized = Math.max(0, Math.round(sales));
    if (normalized < 500000) {
        const remaining = 500000 - normalized;
        return {
            target: 500000,
            remaining,
            progress: clamp01(normalized / 500000),
            message: `${formatKES(remaining)} to enter the ladder`,
        };
    }
    if (normalized < 1000000) {
        const remaining = 1000000 - normalized;
        return {
            target: 1000000,
            remaining,
            progress: clamp01((normalized - 500000) / 500000),
            message: `${formatKES(remaining)} to finish the 500k–1M band`,
        };
    }
    let previous = 1000000;
    for (const point of MARKETPLACE_STEP_POINTS) {
        if (normalized < point) {
            const remaining = point - normalized;
            const progress = clamp01((normalized - previous) / (point - previous));
            return {
                target: point,
                remaining,
                progress,
                message: `${formatKES(remaining)} to reach the ${point / 1000000}M tier`,
            };
        }
        previous = point;
    }
    return {
        target: MARKETPLACE_STEP_POINTS[MARKETPLACE_STEP_POINTS.length - 1],
        remaining: 0,
        progress: 1,
        message: "Top tier reached",
    };
}
function buildTradingWeeks(periodStart) {
    const weeks = [];
    for (let i = 0; i < 4; i += 1) {
        const start = new Date(periodStart);
        start.setDate(periodStart.getDate() + i * 7);
        start.setHours(0, 0, 0, 0);
        const end = endOfWeekSunday(start);
        weeks.push({
            key: `${start.toISOString().slice(0, 10)}`,
            label: `Week ${i + 1} (${formatWeekLabel(start, end)})`,
            start,
            end,
        });
    }
    return weeks;
}
function getReceiptsPayrollPeriodFor(date) {
    const d = new Date(date);
    const day = d.getDate();
    const offsetMonth = day >= 25 ? 0 : -1;
    const start = new Date(d.getFullYear(), d.getMonth() + offsetMonth, 25, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 24, 23, 59, 59, 999);
    const label = `${start.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    return { start, end, label, key: `${start.toISOString()}_${end.toISOString()}` };
}
function getMarketplaceTradingPeriodFor(date) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const anchor = new Date(MARKETPLACE_ANCHOR_START);
    anchor.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
    const periodIndex = diffDays >= 0 ? Math.floor(diffDays / 28) : 0;
    const start = new Date(anchor.getTime() + periodIndex * 28 * DAY_MS);
    const end = new Date(start.getTime() + 27 * DAY_MS);
    end.setHours(23, 59, 59, 999);
    const label = `${start.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    return { start, end, label, key: `MP_${periodIndex}` };
}
function pillClass(active) {
    return [
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
            : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
    ].join(" ");
}
function TradingWeekPicker({ weeks, value, onChange, loading }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Trading week" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Select which week to view" })] }), (0, jsx_runtime_1.jsx)("select", { value: value, onChange: (event) => onChange(event.target.value), className: "rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500", children: weeks.map((week) => ((0, jsx_runtime_1.jsx)("option", { value: week.key, children: week.label }, week.key))) }), loading && (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: "Loading\u2026" })] }));
}
const AssignedShopsCard_1 = __importDefault(require("@/components/AssignedShopsCard"));
function WeeklyEarningsPanel({ weekly, loading, weekLabel }) {
    const rows = weekly?.rows ?? [];
    const totals = weekly?.totals;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Weekly earnings" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-200", children: weekLabel ?? weekly?.rangeLabel ?? "Preview" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)(MiniKpi, { label: "Shops", value: totals ? totals.shops : "-" }), (0, jsx_runtime_1.jsx)(MiniKpi, { label: "Sales", value: totals ? formatKES(totals.sales) : "-" }), (0, jsx_runtime_1.jsx)(MiniKpi, { label: "Commission", value: totals ? formatKES(totals.commission) : "-" })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-5 gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { className: "col-span-2", children: "Shop" }), (0, jsx_runtime_1.jsx)("span", { className: "text-right", children: "Sales" }), (0, jsx_runtime_1.jsx)("span", { className: "text-right", children: "Commission" }), (0, jsx_runtime_1.jsx)("span", { className: "text-right", children: "Channel" })] }), loading && ((0, jsx_runtime_1.jsx)("div", { className: "px-4 py-3 text-sm text-slate-400", children: "Loading weekly earnings\u2026" })), !loading && rows.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "px-4 py-3 text-sm text-slate-400", children: "No weekly shop earnings yet. (Add the endpoint or confirm assignments.)" })), rows.map((r) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-5 gap-2 px-4 py-3 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "col-span-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-slate-100", children: r.shopName }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-500", children: r.weekLabel })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-right text-emerald-300", children: formatKES(r.sales) }), (0, jsx_runtime_1.jsx)("span", { className: "text-right text-slate-200", children: formatKES(r.commission) }), (0, jsx_runtime_1.jsx)("span", { className: "text-right text-slate-300", children: r.platform })] }, `${r.shopId}:${r.weekStart}`)))] })] }));
}
function MiniKpi({ label, value }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-sm font-semibold text-emerald-300", children: value })] }));
}
function AttendantOnlineOpsClient() {
    const receiptsPeriod = (0, react_1.useMemo)(() => getReceiptsPayrollPeriodFor(new Date()), []);
    const marketplacePeriod = (0, react_1.useMemo)(() => getMarketplaceTradingPeriodFor(new Date()), []);
    const tradingWeeks = (0, react_1.useMemo)(() => buildTradingWeeks(marketplacePeriod.start), [marketplacePeriod.start]);
    const [selectedWeekKey, setSelectedWeekKey] = (0, react_1.useState)("");
    const selectedWeek = (0, react_1.useMemo)(() => tradingWeeks.find((week) => week.key === selectedWeekKey) ?? tradingWeeks[0] ?? null, [selectedWeekKey, tradingWeeks]);
    (0, react_1.useEffect)(() => {
        if (!selectedWeekKey && tradingWeeks[0]?.key) {
            setSelectedWeekKey(tradingWeeks[0].key);
        }
    }, [selectedWeekKey, tradingWeeks]);
    const [tab, setTab] = (0, react_1.useState)("overview");
    const [userId, setUserId] = (0, react_1.useState)(null);
    const [userRole, setUserRole] = (0, react_1.useState)(null);
    const [impersonateId, setImpersonateId] = (0, react_1.useState)(null);
    // receipt totals removed (not used in simplified UI)
    const [receiptsEditorRows, setReceiptsEditorRows] = (0, react_1.useState)([createReceipt()]);
    const [shopSalesRows, setShopSalesRows] = (0, react_1.useState)([]);
    const [shopSalesLoading, setShopSalesLoading] = (0, react_1.useState)(false);
    const [weeklyEarnings, setWeeklyEarnings] = (0, react_1.useState)(null);
    const [weeklyLoading, setWeeklyLoading] = (0, react_1.useState)(false);
    // Receipt stats & online summary for QuickStats
    const [receiptRows, setReceiptRows] = (0, react_1.useState)([]);
    const [receiptStatsLoading, setReceiptStatsLoading] = (0, react_1.useState)(false);
    const [onlineSummary, setOnlineSummary] = (0, react_1.useState)(null);
    const [onlineSummaryLoading, setOnlineSummaryLoading] = (0, react_1.useState)(false);
    const [payrollSummary, setPayrollSummary] = (0, react_1.useState)(null);
    const [payrollRows, setPayrollRows] = (0, react_1.useState)(null);
    const [payrollLoading, setPayrollLoading] = (0, react_1.useState)(false);
    const mapPayrollToEarningsSummary = (p) => (0, payrollMapping_1.mapPayrollToEarningsSummary)(p, receiptsCount);
    const mapPayrollToPayrollRow = (p) => (0, payrollMapping_1.mapPayrollToPayrollRow)(p, userId);
    const fetchUser = (0, react_1.useCallback)(async () => {
        try {
            const url = impersonateId ? `/api/attendants/me?impersonateId=${encodeURIComponent(impersonateId)}` : "/api/attendants/me";
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok)
                return;
            const data = await res.json();
            if (data?.user?.id)
                setUserId(data.user.id);
            if (data?.user?.role)
                setUserRole(data.user.role);
        }
        catch (err) {
            console.warn("[attendant/online-ops] failed to load user", err);
        }
    }, [impersonateId]);
    const loadReceiptStats = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        setReceiptStatsLoading(true);
        try {
            const params = new URLSearchParams({
                start: formatNairobiParam(receiptsPeriod.start, false),
                end: formatNairobiParam(receiptsPeriod.end, true),
                issuerOnly: "true",
                includeItems: "true",
                size: "200",
            });
            if (impersonateId) {
                params.set("impersonateId", impersonateId);
                params.set("scope", "mine");
            }
            else {
                params.set("attendantId", userId);
            }
            const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load receipts for payroll period");
            const data = (await res.json());
            setReceiptRows(Array.isArray(data.receipts) ? data.receipts : []);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load receipt totals";
            (0, toast_1.showToast)(msg, "error");
        }
        finally {
            setReceiptStatsLoading(false);
        }
    }, [userId, receiptsPeriod, userRole]);
    const loadOnlineSummary = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        setOnlineSummaryLoading(true);
        try {
            const params = new URLSearchParams({
                start: formatNairobiParam(receiptsPeriod.start, false),
                end: formatNairobiParam(receiptsPeriod.end, true),
            });
            if (impersonateId) {
                params.set("impersonateId", impersonateId);
                params.set("scope", "mine");
            }
            else
                params.set("attendantId", userId);
            const res = await fetch(`/api/online/summary?${params.toString()}`, { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load online summary for payroll period");
            const data = (await res.json());
            setOnlineSummary(data);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load online totals";
            (0, toast_1.showToast)(msg, "error");
        }
        finally {
            setOnlineSummaryLoading(false);
        }
    }, [userId, receiptsPeriod]);
    const loadPayrollSummary = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        setPayrollLoading(true);
        try {
            const params = new URLSearchParams({
                start: formatNairobiParam(receiptsPeriod.start, false),
                end: formatNairobiParam(receiptsPeriod.end, true),
            });
            if (impersonateId) {
                params.set("impersonateId", impersonateId);
                params.set("scope", "mine");
            }
            else
                params.set("attendantId", userId);
            setPayrollRows(null);
            // If we're an admin, try the richer admin endpoint which returns many rows
            if (userRole === "ADMIN") {
                const adminRes = await fetch(`/api/admin/payroll/summary?${params.toString()}`, { cache: "no-store" });
                if (adminRes.ok) {
                    const adminData = await adminRes.json();
                    setPayrollRows(Array.isArray(adminData.rows) ? adminData.rows : []);
                    setPayrollSummary(null);
                    return;
                }
            }
            // Non-admin attendants should use the attendant earnings summary endpoint
            const res = await fetch(`/api/attendant/earnings/summary?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                // if endpoint missing, show placeholder by clearing summary
                setPayrollSummary(null);
                return;
            }
            const data = (await res.json());
            setPayrollSummary(data);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load payroll summary";
            (0, toast_1.showToast)(msg, "error");
            setPayrollSummary(null);
        }
        finally {
            setPayrollLoading(false);
        }
    }, [userId, receiptsPeriod]);
    // receipt totals loader removed — keeping receipts editor only
    const loadShopSales = (0, react_1.useCallback)(async () => {
        if (!userId || !selectedWeek)
            return;
        setShopSalesLoading(true);
        try {
            const params = new URLSearchParams({
                start: formatNairobiParam(selectedWeek.start, false),
                end: formatNairobiParam(selectedWeek.end, true),
            });
            if (impersonateId) {
                params.set("impersonateId", impersonateId);
                params.set("scope", "mine");
            }
            else
                params.set("attendantId", userId);
            const res = await fetch(`/api/online/shops/sales?${params.toString()}`, { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load assigned shops");
            const data = (await res.json());
            setShopSalesRows(Array.isArray(data.rows) ? data.rows : []);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Unable to load assigned shops";
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setShopSalesLoading(false);
        }
    }, [selectedWeek, userId]);
    const loadWeeklyEarnings = (0, react_1.useCallback)(async () => {
        if (!userId || !selectedWeek)
            return;
        setWeeklyLoading(true);
        try {
            const params = new URLSearchParams({
                start: formatNairobiParam(selectedWeek.start, false),
                end: formatNairobiParam(selectedWeek.end, true),
            });
            if (impersonateId)
                params.set("impersonateId", impersonateId);
            else
                params.set("attendantId", userId);
            const res = await fetch(`/api/online/weekly/shops/earnings?${params.toString()}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                setWeeklyEarnings(null);
                return;
            }
            const data = (await res.json());
            setWeeklyEarnings(data);
        }
        catch {
            setWeeklyEarnings(null);
        }
        finally {
            setWeeklyLoading(false);
        }
    }, [selectedWeek, userId]);
    const salesRecordsTotals = (0, react_1.useMemo)(() => {
        return receiptsEditorRows.reduce((acc, receipt) => {
            const sale = Number(receipt.sellingTotal || 0);
            acc.totalSales += sale;
            acc.totalItems += receipt.items.length;
            acc.totalReceipts += 1;
            return acc;
        }, { totalSales: 0, totalItems: 0, totalReceipts: 0 });
    }, [receiptsEditorRows]);
    (0, react_1.useEffect)(() => {
        const imp = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("impersonateId") : null;
        setImpersonateId(imp);
    }, []);
    (0, react_1.useEffect)(() => {
        // When impersonation toggles, clear potentially stale state and reload the resolved user
        setReceiptRows([]);
        setOnlineSummary(null);
        setUserId(null);
        setUserRole(null);
        void fetchUser();
    }, [impersonateId, fetchUser]);
    // receipt totals loader previously triggered here; removed
    (0, react_1.useEffect)(() => {
        if (!userId || !selectedWeek)
            return;
        void loadShopSales();
        void loadWeeklyEarnings();
        void loadReceiptStats();
        void loadOnlineSummary();
        void loadPayrollSummary();
    }, [loadShopSales, loadWeeklyEarnings, loadReceiptStats, loadOnlineSummary, loadPayrollSummary, selectedWeek, userId]);
    const directSales = (0, react_1.useMemo)(() => {
        return receiptRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    }, [receiptRows]);
    // normalize/compose canonical keys for local POS receipts and merge with server canonical keys
    const receiptsCount = (0, react_1.useMemo)(() => {
        // prefer canonical keys from payroll/attendant earnings summary (authoritative per-receipt map)
        const serverKeys = payrollSummary?.perReceiptCanonicalKeys ?? (onlineSummary?.perReceiptCanonicalKeys ?? []);
        const localKeys = (receiptRows ?? []).map((r) => {
            // prefer receiptNumber/orderRef, fall back to id
            const createdAt = r.createdAt ?? r.generatedAt ?? new Date().toISOString();
            const d = new Date(createdAt);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const businessDate = `${y}-${m}-${day}`;
            const raw = (r.receiptNumber ?? r.orderRef ?? r.receiptRef ?? r.id ?? "");
            const serial = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (serial && serial.length > 0)
                return `${businessDate}:${serial}`;
            return `ID:${String(r.id ?? raw ?? "")}`;
        });
        const union = new Set([...serverKeys, ...localKeys]);
        return union.size;
    }, [receiptRows, onlineSummary]);
    const platformTotals = (0, react_1.useMemo)(() => {
        const platforms = onlineSummary?.platforms ?? [];
        const jumia = platforms.find((p) => String(p.key).toUpperCase() === "JUMIA");
        const kilimall = platforms.find((p) => String(p.key).toUpperCase() === "KILIMALL");
        return {
            jumiaSales: Number(jumia?.sales || 0),
            kilimallSales: Number(kilimall?.sales || 0),
            marketplaceCommission: Number(onlineSummary?.totals?.commission || 0),
        };
    }, [onlineSummary]);
    const totalSales = directSales + platformTotals.jumiaSales + platformTotals.kilimallSales;
    // Prefer server-calculated marketplace sales when available (includes payout weeks and weekly manual)
    const marketplaceSales = Number(onlineSummary?.totals?.marketplaceSales ?? platformTotals.jumiaSales + platformTotals.kilimallSales);
    const tierInfo = (0, react_1.useMemo)(() => describeMarketplaceTier(marketplaceSales), [marketplaceSales]);
    const quickStatsCommission = (0, react_1.useMemo)(() => {
        const payrollValue = payrollSummary?.commissionTotal ??
            payrollSummary?.grossCommission ??
            payrollSummary?.salesCommission ??
            ((payrollSummary?.commissionDirect ?? 0) +
                (payrollSummary?.commissionMarketplaceJumia ?? 0) +
                (payrollSummary?.commissionMarketplaceKilimall ?? 0));
        if (payrollValue > 0) {
            return Math.round(payrollValue);
        }
        return Math.round(Number(onlineSummary?.totals?.commission ?? 0));
    }, [onlineSummary, payrollSummary]);
    const quickStatsData = {
        periodLabel: receiptsPeriod.label,
        jumiaSales: platformTotals.jumiaSales,
        kilimallSales: platformTotals.kilimallSales,
        directSales,
        receiptsCount,
        totalSales,
        commission: quickStatsCommission,
        marketplaceSales,
        tierProgress: tierInfo.progress,
        toNextTier: tierInfo.remaining,
        tierMessage: undefined,
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsxs)("main", { className: "mx-auto max-w-7xl space-y-6 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Online Ops" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-300", children: ["One dashboard for ", (0, jsx_runtime_1.jsx)("span", { className: "text-emerald-200", children: "Direct Sales" }), " and", " ", (0, jsx_runtime_1.jsx)("span", { className: "text-emerald-200", children: "Jumia/Kilimall" }), " shops."] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)("button", { className: pillClass(tab === "overview"), onClick: () => setTab("overview"), children: "Overview" }), (0, jsx_runtime_1.jsx)("button", { className: pillClass(tab === "shops"), onClick: () => setTab("shops"), children: "Weekly earnings" }), (0, jsx_runtime_1.jsx)("button", { className: pillClass(tab === "receipts"), onClick: () => setTab("receipts"), children: "Receipts" }), (0, jsx_runtime_1.jsx)("button", { className: pillClass(tab === "payroll"), onClick: () => setTab("payroll"), children: "Payroll" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", className: "px-5", onClick: () => (window.location.href = "/attendant/daily-report"), children: "Open Daily Report" }) })] }), tab === "overview" && ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-12", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 lg:col-span-8", children: [(0, jsx_runtime_1.jsx)(AssignedShopsCard_1.default, { rows: shopSalesRows, loading: shopSalesLoading, weekLabel: selectedWeek?.label ?? "Week view" }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Weekly earnings" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Your shops & marketplace" })] }), (0, jsx_runtime_1.jsx)(TradingWeekPicker, { weeks: tradingWeeks, value: selectedWeekKey, onChange: setSelectedWeekKey, loading: weeklyLoading })] }), (0, jsx_runtime_1.jsx)(WeeklyEarningsPanel, { weekly: weeklyEarnings, loading: weeklyLoading, weekLabel: selectedWeek?.label })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 lg:col-span-4", children: [(0, jsx_runtime_1.jsx)(QuickStatsCard_1.default, { variant: "onlineOps", loading: receiptStatsLoading || onlineSummaryLoading, onlineOps: quickStatsData }), (0, jsx_runtime_1.jsx)(EarningsCard_1.default, { summary: mapPayrollToEarningsSummary(payrollSummary) }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-6 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Direct sales" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Add receipts for today" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["Totals are calculated within your payroll period (", receiptsPeriod.label, ")."] })] }), (0, jsx_runtime_1.jsx)(ReceiptsEditor_1.default, { receipts: receiptsEditorRows, setReceipts: setReceiptsEditorRows, totals: {
                                                totalSales: salesRecordsTotals.totalSales,
                                                totalProfit: 0,
                                                totalItems: salesRecordsTotals.totalItems,
                                            }, hideBuyingPrice: true }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Total receipts:", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-300", children: salesRecordsTotals.totalReceipts })] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Total sales (KES):", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-300", children: formatKES(salesRecordsTotals.totalSales) })] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Total items:", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-300", children: salesRecordsTotals.totalItems })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", className: "px-4", onClick: () => (window.location.href = "/receipts"), children: "Open receipts desk" }) })] })] })] })), tab === "shops" && ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-12", children: [(0, jsx_runtime_1.jsx)("div", { className: "space-y-6 lg:col-span-8", children: (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Weekly breakdown" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Shops this week" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Refresh to sync the latest statements." })] }), (0, jsx_runtime_1.jsx)(TradingWeekPicker, { weeks: tradingWeeks, value: selectedWeekKey, onChange: setSelectedWeekKey, loading: weeklyLoading })] }), (0, jsx_runtime_1.jsx)(WeeklyEarningsPanel, { weekly: weeklyEarnings, loading: weeklyLoading, weekLabel: selectedWeek?.label })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4 lg:col-span-4" })] })), tab === "receipts" && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-6 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Direct sales" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Add receipts for today" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["Totals are calculated automatically within your payroll period (", receiptsPeriod.label, ")."] })] }), (0, jsx_runtime_1.jsx)(ReceiptsEditor_1.default, { receipts: receiptsEditorRows, setReceipts: setReceiptsEditorRows, totals: {
                                    totalSales: salesRecordsTotals.totalSales,
                                    totalProfit: 0,
                                    totalItems: salesRecordsTotals.totalItems,
                                }, hideBuyingPrice: true }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Total receipts:", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-300", children: salesRecordsTotals.totalReceipts })] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Total sales (KES):", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-300", children: formatKES(salesRecordsTotals.totalSales) })] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Total items:", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-300", children: salesRecordsTotals.totalItems })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", className: "px-4", onClick: () => (window.location.href = "/receipts"), children: "Open receipts desk" }) })] }) })), tab === "payroll" && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: (0, jsx_runtime_1.jsx)("div", { className: "grid gap-6 lg:grid-cols-12", children: (0, jsx_runtime_1.jsx)("div", { className: "space-y-6 lg:col-span-12", children: payrollLoading && !payrollSummary && !payrollRows ? ((0, jsx_runtime_1.jsx)(Card_1.default, { className: "p-6 text-center", children: "Loading payroll summary\u2026" })) : payrollRows && payrollRows.length > 0 ? ((0, jsx_runtime_1.jsx)(PayrollTableClient_1.default, { rows: payrollRows, periodLabel: receiptsPeriod.label })) : payrollSummary ? ((0, jsx_runtime_1.jsx)(PayrollTableClient_1.default, { rows: [mapPayrollToPayrollRow(payrollSummary)], periodLabel: receiptsPeriod.label })) : ((0, jsx_runtime_1.jsx)(Card_1.default, { className: "p-6 text-center", children: "Payroll data not available for this period." })) }) }) }))] }) }));
}
