"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantOnlineClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
// SensitiveValue and card-lock helpers removed (cards cleaned up)
const QuickStatsCard_1 = __importDefault(require("@/components/QuickStatsCard"));
const useCardLock_1 = require("@/app/_components/useCardLock");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const toast_1 = require("@/lib/ui/toast");
const link_1 = __importDefault(require("next/link"));
// Marketplace trading weeks anchor (kept in sync with other clients)
const MARKETPLACE_ANCHOR_START = new Date("2025-11-24T00:00:00+03:00");
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
function buildTradingWeeks(periodStart) {
    const weeks = [];
    for (let i = 0; i < 4; i += 1) {
        const start = new Date(periodStart);
        start.setDate(periodStart.getDate() + i * 7);
        start.setHours(0, 0, 0, 0);
        const end = endOfWeekSunday(start);
        weeks.push({ key: `${start.toISOString().slice(0, 10)}`, label: `Week ${i + 1} (${formatWeekLabel(start, end)})`, start, end });
    }
    return weeks;
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
    const label = `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    return { start, end, label, key: `MP_${periodIndex}` };
}
// Preview commission from server (falls back to null until fetched)
const COMMISSION_RATE = undefined;
const formatKES = (value) => `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const safeNumber = (value) => Number(value ?? 0);
const toInputDate = (date) => 
// produce a YYYY-MM-DD string in Nairobi local date so inputs and
// range builders are consistent with server-side Nairobi midnights
date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const formatNairobiParam = (date, endOfDay = false) => {
    const ymd = date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
    return endOfDay ? `${ymd}T23:59:59.999+03:00` : `${ymd}T00:00:00+03:00`;
};
function AttendantOnlineClient() {
    const [period] = (0, react_1.useState)(() => (0, tradingPeriod_1.getTradingPeriodFor)(new Date()));
    const [userId, setUserId] = (0, react_1.useState)(null);
    const [userRole, setUserRole] = (0, react_1.useState)(null);
    const [impersonated, setImpersonated] = (0, react_1.useState)(false);
    const [impersonatedBy, setImpersonatedBy] = (0, react_1.useState)(null);
    const [impersonateId, setImpersonateId] = (0, react_1.useState)(null);
    const appendImpersonateParam = (0, react_1.useCallback)((params) => {
        if (impersonateId) {
            params.set("impersonateId", impersonateId);
            // When impersonating, explicitly request mine scope to avoid global leakage
            params.set("scope", "mine");
        }
    }, [impersonateId]);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined")
            return;
        const params = new URLSearchParams(window.location.search);
        const imp = params.get("impersonateId");
        if (imp) {
            setImpersonateId(imp);
        }
    }, []);
    const identityMatches = (0, react_1.useCallback)((meta) => {
        if (!impersonateId || !meta?.resolvedUserId)
            return true;
        const matches = meta.resolvedUserId === impersonateId;
        if (!matches) {
            console.warn("[attendant/online] dropping response due to identity mismatch", { impersonateId, resolved: meta.resolvedUserId, meta });
        }
        return matches;
    }, [impersonateId]);
    const parseIdentityResponse = (0, react_1.useCallback)(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!payload)
            return null;
        if (!identityMatches(payload.meta))
            return null;
        return payload.data ?? payload;
    }, [identityMatches]);
    // receipt totals & quick stats removed from right column
    const [shopSalesRows, setShopSalesRows] = (0, react_1.useState)([]);
    const [shopSalesLoading, setShopSalesLoading] = (0, react_1.useState)(false);
    const [shopRange, setShopRange] = (0, react_1.useState)("period");
    const [shopPeriodLabel, setShopPeriodLabel] = (0, react_1.useState)(period.label);
    const [shopPeriodTotal, setShopPeriodTotal] = (0, react_1.useState)(0);
    const [shopAllTimeTotal, setShopAllTimeTotal] = (0, react_1.useState)(0);
    const [marketplacePeriodIndex, setMarketplacePeriodIndex] = (0, react_1.useState)(0);
    const marketplacePeriod = (0, react_1.useMemo)(() => {
        const reference = new Date();
        reference.setHours(0, 0, 0, 0);
        reference.setDate(reference.getDate() + marketplacePeriodIndex * 28);
        return getMarketplaceTradingPeriodFor(reference);
    }, [marketplacePeriodIndex]);
    const [tradingWeeks, setTradingWeeks] = (0, react_1.useState)(() => buildTradingWeeks(marketplacePeriod.start));
    (0, react_1.useEffect)(() => {
        setTradingWeeks(buildTradingWeeks(marketplacePeriod.start));
    }, [marketplacePeriod]);
    const [activeWeekKeys, setActiveWeekKeys] = (0, react_1.useState)([]);
    const [weeklyEarnings, setWeeklyEarnings] = (0, react_1.useState)(null);
    const [weeklyLoading, setWeeklyLoading] = (0, react_1.useState)(false);
    const [onlineSummary, setOnlineSummary] = (0, react_1.useState)(null);
    const [onlineSummaryLoading, setOnlineSummaryLoading] = (0, react_1.useState)(false);
    // receipt totals & payroll (quick stats + earnings) re-enabled
    const [receiptRows, setReceiptRows] = (0, react_1.useState)([]);
    const [receiptStatsLoading, setReceiptStatsLoading] = (0, react_1.useState)(false);
    const [payrollSummary, setPayrollSummary] = (0, react_1.useState)(null);
    const [payrollLoading, setPayrollLoading] = (0, react_1.useState)(false);
    const fetchUser = (0, react_1.useCallback)(async () => {
        try {
            const params = new URLSearchParams();
            appendImpersonateParam(params);
            const query = params.toString();
            const res = await fetch(`/api/attendants/me${query ? `?${query}` : ""}`, { cache: "no-store" });
            if (!res.ok)
                return;
            const payload = await parseIdentityResponse(res);
            if (!payload)
                return;
            if (payload?.user?.id)
                setUserId(payload.user.id);
            if (payload?.user?.role)
                setUserRole(payload.user.role);
            // capture impersonation metadata when present so UI can surface it
            if (payload?.impersonated) {
                setImpersonated(true);
                setImpersonatedBy(payload?.impersonatedBy ?? null);
            }
            else {
                setImpersonated(false);
                setImpersonatedBy(null);
            }
        }
        catch (err) {
            console.warn("[attendant/online] failed to load user", err);
        }
    }, [appendImpersonateParam]);
    const getActiveWeekRange = (0, react_1.useCallback)(() => {
        const keys = activeWeekKeys.length ? activeWeekKeys : ["period"];
        if (keys.includes("period")) {
            return { start: marketplacePeriod.start, end: marketplacePeriod.end };
        }
        const selectedWeeks = tradingWeeks.filter((week) => keys.includes(week.key));
        if (!selectedWeeks.length) {
            return { start: marketplacePeriod.start, end: marketplacePeriod.end };
        }
        const start = new Date(Math.min(...selectedWeeks.map((week) => week.start.getTime())));
        const end = new Date(Math.max(...selectedWeeks.map((week) => week.end.getTime())));
        return { start, end };
    }, [activeWeekKeys, tradingWeeks, marketplacePeriod]);
    const loadWeeklyEarnings = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        const { start, end } = getActiveWeekRange();
        if (!start || !end)
            return;
        setWeeklyLoading(true);
        try {
            const params = new URLSearchParams({
                attendantId: userId,
                start: formatNairobiParam(start, false),
                end: formatNairobiParam(end, true),
            });
            appendImpersonateParam(params);
            const res = await fetch(`/api/online/weekly/shops/earnings?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                setWeeklyEarnings(null);
                return;
            }
            const payload = await parseIdentityResponse(res);
            if (!payload) {
                setWeeklyEarnings(null);
                return;
            }
            setWeeklyEarnings(payload);
        }
        catch (err) {
            setWeeklyEarnings(null);
        }
        finally {
            setWeeklyLoading(false);
        }
    }, [getActiveWeekRange, userId, appendImpersonateParam]);
    const loadOnlineSummary = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        setOnlineSummaryLoading(true);
        try {
            const params = new URLSearchParams({
                start: formatNairobiParam(period.start, false),
                end: formatNairobiParam(period.end, true),
            });
            appendImpersonateParam(params);
            const res = await fetch(`/api/online/summary?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                setOnlineSummary(null);
                return;
            }
            const payload = await parseIdentityResponse(res);
            if (!payload) {
                setOnlineSummary(null);
                return;
            }
            setOnlineSummary(payload);
        }
        catch (err) {
            setOnlineSummary(null);
        }
        finally {
            setOnlineSummaryLoading(false);
        }
    }, [period, userId, appendImpersonateParam]);
    const loadReceiptStats = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        setReceiptStatsLoading(true);
        try {
            const params = new URLSearchParams({
                attendantId: userId,
                start: formatNairobiParam(period.start, false),
                end: formatNairobiParam(period.end, true),
                issuerOnly: "true",
                includeItems: "true",
                size: "200",
            });
            appendImpersonateParam(params);
            const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load receipts for payroll period");
            const payload = await parseIdentityResponse(res);
            if (!payload)
                throw new Error("Failed to load receipts for payroll period");
            setReceiptRows(Array.isArray(payload.receipts) ? payload.receipts : []);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load receipt totals";
            (0, toast_1.showToast)(msg, "error");
        }
        finally {
            setReceiptStatsLoading(false);
        }
    }, [userId, period, appendImpersonateParam]);
    const loadPayrollSummary = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        setPayrollLoading(true);
        try {
            const params = new URLSearchParams({
                attendantId: userId,
                start: formatNairobiParam(period.start, false),
                end: formatNairobiParam(period.end, true),
            });
            appendImpersonateParam(params);
            // If user is an admin, prefer the richer admin endpoint which may return multiple rows
            if (userRole === "ADMIN") {
                try {
                    const adminRes = await fetch(`/api/admin/payroll/summary?${params.toString()}`, { cache: "no-store" });
                    if (adminRes.ok) {
                        const adminPayload = await parseIdentityResponse(adminRes);
                        const rows = Array.isArray(adminPayload?.rows) ? adminPayload.rows : [];
                        if (rows.length > 0) {
                            setPayrollSummary(rows[0]);
                            return;
                        }
                    }
                }
                catch (e) {
                    // fall through to normal endpoint on error
                }
            }
            // For attendants, use the attendant earnings summary endpoint (existing route)
            const res = await fetch(`/api/attendant/earnings/summary?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                setPayrollSummary(null);
                return;
            }
            const payload = await parseIdentityResponse(res);
            if (!payload) {
                setPayrollSummary(null);
                return;
            }
            setPayrollSummary(payload);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load payroll summary";
            (0, toast_1.showToast)(msg, "error");
            setPayrollSummary(null);
        }
        finally {
            setPayrollLoading(false);
        }
    }, [userId, period, appendImpersonateParam]);
    // receiptTotals loader removed
    const loadShopSales = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        setShopSalesLoading(true);
        try {
            const { start, end } = computeRangeDates(shopRange, period);
            const params = new URLSearchParams({
                range: shopRange,
                attendantId: userId,
            });
            if (start)
                params.set("start", start);
            if (end)
                params.set("end", end);
            appendImpersonateParam(params);
            const res = await fetch(`/api/online/shops/sales?${params.toString()}`, {
                cache: "no-store",
            });
            if (!res.ok)
                throw new Error("Failed to load shop sales");
            const payload = await parseIdentityResponse(res);
            if (!payload)
                throw new Error("Failed to load shop sales");
            setShopSalesRows(Array.isArray(payload.rows) ? payload.rows : []);
            setShopPeriodLabel(payload.periodLabel ?? period.label);
            setShopPeriodTotal(payload.periodTotal ?? 0);
            setShopAllTimeTotal(payload.totalToDate ?? 0);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Unable to load shop sales";
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setShopSalesLoading(false);
        }
    }, [period, shopRange, userId, appendImpersonateParam]);
    // receiptTotals derived state removed (Quick stats removed)
    const weeklyTotals = weeklyEarnings?.totals ?? { orders: 0, sales: 0, commission: 0, shops: 0 };
    const platformAggregates = (0, react_1.useMemo)(() => {
        const rows = weeklyEarnings?.rows ?? [];
        const map = {};
        for (const r of rows) {
            const key = String(r.platform ?? "UNKNOWN").toUpperCase();
            if (!map[key]) {
                map[key] = { key, name: r.platform ?? key, orders: 0, sales: 0, commission: 0 };
            }
            map[key] = {
                ...map[key],
                orders: map[key].orders + Number(r.orders ?? 0),
                sales: map[key].sales + Number(r.sales ?? 0),
                commission: map[key].commission + Number(r.commission ?? 0),
            };
        }
        const ensurePlatform = (code, label) => {
            if (!map[code]) {
                map[code] = { key: code, name: label, orders: 0, sales: 0, commission: 0 };
            }
        };
        ensurePlatform("JUMIA", "Jumia");
        ensurePlatform("KILIMALL", "Kilimall");
        return Object.values(map);
    }, [weeklyEarnings]);
    const platformTotals = (0, react_1.useMemo)(() => {
        const jumia = platformAggregates.find((p) => p.key === "JUMIA");
        const kilimall = platformAggregates.find((p) => p.key === "KILIMALL");
        return {
            jumiaSales: Number(jumia?.sales || 0),
            kilimallSales: Number(kilimall?.sales || 0),
            marketplaceCommission: Number(weeklyTotals.commission || 0),
        };
    }, [platformAggregates, weeklyTotals]);
    const accountRows = weeklyEarnings?.rows ?? [];
    const directSales = (0, react_1.useMemo)(() => {
        return receiptRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    }, [receiptRows]);
    const receiptsCount = (0, react_1.useMemo)(() => {
        const serverKeys = payrollSummary?.perReceiptCanonicalKeys ?? [];
        const localKeys = (receiptRows ?? []).map((r) => {
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
    }, [receiptRows, payrollSummary]);
    const totalSales = directSales + platformTotals.jumiaSales + platformTotals.kilimallSales;
    const [previewCommission, setPreviewCommission] = (0, react_1.useState)(null);
    const commission = payrollSummary?.commissionTotal ?? payrollSummary?.commission ?? previewCommission ?? 0;
    const nextTierTarget = 1000000;
    const toNextTier = Math.max(0, nextTierTarget - totalSales);
    (0, react_1.useEffect)(() => {
        fetchUser();
        // choose default week: previous week to the one containing today (if available)
        const today = new Date();
        const idx = tradingWeeks.findIndex((w) => today >= w.start && today <= w.end);
        const defaultIdx = idx > 0 ? idx - 1 : idx >= 0 ? idx : 0;
        const defaultKey = tradingWeeks[defaultIdx]?.key ?? tradingWeeks[0]?.key ?? "period";
        setActiveWeekKeys((prev) => (prev.length ? prev : [defaultKey]));
    }, [fetchUser, tradingWeeks]);
    // show a small banner when viewing as another attendant
    const ImpersonationBanner = () => {
        if (!impersonated)
            return null;
        return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-md border border-amber-600 bg-amber-900/30 px-3 py-2 text-sm text-amber-100", children: ["Viewing as another attendant", impersonatedBy ? ` (impersonated by ${impersonatedBy})` : "", " \u2014 some data may not match your account."] }));
    };
    const loadCommissionPreview = (0, react_1.useCallback)(async () => {
        if (!userId)
            return;
        try {
            const params = new URLSearchParams({
                attendantId: userId,
                start: formatNairobiParam(period.start, false),
                end: formatNairobiParam(period.end, true),
            });
            appendImpersonateParam(params);
            const res = await fetch(`/api/online/preview-commission?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                setPreviewCommission(null);
                return;
            }
            const payload = await parseIdentityResponse(res);
            if (!payload) {
                setPreviewCommission(null);
                return;
            }
            setPreviewCommission(Number(payload.totalCommission ?? 0));
        }
        catch (err) {
            setPreviewCommission(null);
        }
    }, [userId, period, appendImpersonateParam]);
    (0, react_1.useEffect)(() => {
        if (!userId)
            return;
        void loadCommissionPreview();
    }, [loadCommissionPreview, userId, period]);
    (0, react_1.useEffect)(() => {
        if (!userId)
            return;
        void loadShopSales();
        void loadReceiptStats();
        void loadPayrollSummary();
        void loadOnlineSummary();
    }, [loadShopSales, loadReceiptStats, loadPayrollSummary, userId]);
    (0, react_1.useEffect)(() => {
        if (!userId)
            return;
        void loadWeeklyEarnings();
    }, [loadWeeklyEarnings, userId]);
    // earnings summary loader removed
    // Prefer authoritative online summary (trading-period marketplace totals) when available.
    const quickStatsPeriodLabel = onlineSummary?.period?.label ?? weeklyEarnings?.rangeLabel ?? period.label;
    const marketplace = onlineSummary?.marketplace ?? null;
    const aggregatorJumiaSales = platformTotals.jumiaSales;
    const aggregatorKilimallSales = platformTotals.kilimallSales;
    const aggregatorMarketplaceSalesOnly = aggregatorJumiaSales + aggregatorKilimallSales;
    const quickJumiaSales = marketplace && Number(marketplace.jumiaSales ?? 0) > 0 ? Number(marketplace.jumiaSales) : aggregatorJumiaSales;
    const quickKilimallSales = marketplace && Number(marketplace.kilimallSales ?? 0) > 0
        ? Number(marketplace.kilimallSales)
        : aggregatorKilimallSales;
    const quickMarketplaceSalesOnly = marketplace && Number(marketplace.marketplaceSalesOnly ?? 0) > 0
        ? Number(marketplace.marketplaceSalesOnly)
        : aggregatorMarketplaceSalesOnly;
    const quickStatsPayload = {
        periodLabel: quickStatsPeriodLabel,
        jumiaSales: quickJumiaSales,
        kilimallSales: quickKilimallSales,
        directSales,
        receiptsCount,
        totalSales: quickMarketplaceSalesOnly + directSales,
        commission: payrollSummary?.commissionTotal ?? payrollSummary?.commission ?? commission,
        toNextTier: Number(marketplace?.toNextTier ?? toNextTier),
        tierProgress: Number(marketplace?.tierProgress ?? 0),
        tierMessage: marketplace?.commissionInfo?.nextTarget ? undefined : "Max tier reached",
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsxs)("main", { className: "mx-auto max-w-6xl space-y-6 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Online Operations" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Track marketplace shop sales, receipt activity, and payroll-linked earnings in one place." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3 rounded-full border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: userId ? `/receipts?attendantId=${encodeURIComponent(userId)}` : "/receipts", className: "rounded-full border border-transparent px-3 py-1 transition hover:border-slate-500", children: "Receipts" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/receipts", className: "rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-emerald-200 transition hover:bg-emerald-500/30", children: "Create receipt" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/api/auth/signout", className: "rounded-full border border-transparent px-3 py-1 transition hover:border-slate-500", children: "Log out" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-12", children: [(0, jsx_runtime_1.jsx)("div", { className: "space-y-6 lg:col-span-8", children: (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Online orders & channels" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Marketplace overview" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "See how your sales are distributed across marketplaces." }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-amber-300", children: "Marketplace ladder is memo-only and may be withheld for misconduct, abandonment, or resignation." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70", children: [(0, jsx_runtime_1.jsxs)("div", { className: "px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Total sales (selected range)" }), (0, jsx_runtime_1.jsx)("p", { className: "text-3xl font-semibold text-white", children: formatKES(weeklyTotals.sales) }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-500", children: ["Commission: ", formatKES(weeklyTotals.commission)] })] }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", className: "px-4", onClick: () => void loadWeeklyEarnings(), disabled: weeklyLoading, children: weeklyLoading ? "Refreshing…" : "Refresh online stats" })] }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-xs text-slate-500", children: "Click week chips to combine totals across multiple weeks or choose the marketplace period for everything." }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex flex-wrap gap-2", children: [tradingWeeks.map((week) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                                    if (activeWeekKeys.includes("period")) {
                                                                        setActiveWeekKeys([week.key]);
                                                                        return;
                                                                    }
                                                                    if (activeWeekKeys.includes(week.key)) {
                                                                        const remaining = activeWeekKeys.filter((key) => key !== week.key);
                                                                        setActiveWeekKeys(remaining.length ? remaining : [week.key]);
                                                                        return;
                                                                    }
                                                                    setActiveWeekKeys([...activeWeekKeys, week.key]);
                                                                }, className: [
                                                                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                                                                    activeWeekKeys.includes(week.key)
                                                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                                                                        : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
                                                                ].join(" "), children: week.label }, week.key))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setActiveWeekKeys(["period"]), className: [
                                                                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                                                                    activeWeekKeys.includes("period")
                                                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                                                                        : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
                                                                ].join(" "), children: "This marketplace period" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Marketplace window:" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-emerald-300", children: marketplacePeriod.label }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", className: "px-3", onClick: () => setMarketplacePeriodIndex((prev) => Math.max(prev - 1, -12)), children: "Previous marketplace period" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", className: "px-3", onClick: () => setMarketplacePeriodIndex(0), disabled: marketplacePeriodIndex === 0, children: "This marketplace period" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "border-t border-slate-800 px-4 pt-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: "Accounts" }), (0, jsx_runtime_1.jsx)("span", { className: "text-right", children: "Sales / Commission" })] }), accountRows.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "py-4 text-sm text-slate-400", children: "Select a week or the full period to see account sales." })) : (accountRows.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-2 border-t border-slate-800 py-3 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: row.shopName }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: row.platform })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-end text-right", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-emerald-300", children: formatKES(row.sales) }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: formatKES(row.commission) })] })] }, `${row.shopId}-${row.weekStart}`))))] })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 lg:col-span-4", children: [(0, jsx_runtime_1.jsx)(QuickStatsCard_1.default, { variant: "onlineOps", loading: receiptStatsLoading || weeklyLoading, onlineOps: quickStatsPayload }), (0, jsx_runtime_1.jsx)(PayrollEarningsCard, { summary: payrollSummary, loading: payrollLoading, periodLabel: period.label, fallbackCommission: commission })] })] })] }) }));
}
// Marketplace Assigned shops card removed per request
function PayrollEarningsCard({ summary, loading, periodLabel, fallbackCommission = 0, }) {
    const commissionValue = Number(summary?.commission ?? summary?.commissionTotal ?? summary?.salesCommission ?? fallbackCommission ?? 0);
    const chamaValue = Number(summary?.chamaTotal ?? summary?.chama ?? summary?.adjustmentBreakdown?.chama ?? 0);
    const bonusValue = Number(summary?.bonusTotal ?? 0);
    const totalDeductions = Number(summary?.totalDeductions ?? 0);
    let deductionBreakdown = [];
    const adjEntries = (summary?.adjustmentEntries ?? []);
    if (adjEntries && adjEntries.length > 0) {
        deductionBreakdown = adjEntries
            .filter((e) => String(e.adjustmentKind || "DEDUCTION").toUpperCase() === "DEDUCTION")
            .map((e) => [String(e.label || e.adjustmentType), Number(e.amount ?? 0)]);
    }
    else {
        const fallback = [
            ["Chama", chamaValue],
            ["Lateness", Number(summary?.latenessTotal ?? 0)],
            ["Discipline", Number(summary?.disciplineTotal ?? 0)],
            ["Other", Number(summary?.otherDeductionsTotal ?? 0)],
            ["Penalties", Number(summary?.adjustmentBreakdown?.penalties ?? 0)],
        ];
        deductionBreakdown = fallback.filter(([, amount]) => Number(amount) > 0);
    }
    const rows = [
        { label: "Base salary", value: Number(summary?.baseSalary ?? 0) },
        { label: "Commission", value: commissionValue },
        { label: "Chama", value: chamaValue },
        { label: "Bonuses", value: bonusValue },
        { label: "Deductions", value: totalDeductions },
    ];
    const netPay = summary?.netPay ?? summary?.netPayTotal ?? 0;
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("onlineops:earnings");
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-slate-100", children: "Earnings this period" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: periodLabel })] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: "NET PAY" }), (0, jsx_runtime_1.jsx)("span", { className: "text-emerald-300 font-semibold", children: locked ? "•••" : formatKES(netPay) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [rows.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-2xl bg-slate-950/60 px-3 py-3 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: row.label }), (0, jsx_runtime_1.jsx)("span", { className: "text-base font-semibold text-emerald-300", children: locked ? "•••" : formatKES(row.value) })] }, row.label))), rows.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: loading ? "Loading..." : "No earnings data" })), deductionBreakdown.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 rounded-2xl bg-slate-950/60 px-3 py-3 text-xs text-slate-400", children: [(0, jsx_runtime_1.jsx)("p", { className: "uppercase tracking-wide text-[10px]", children: "Payroll deduction summary" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-200", children: deductionBreakdown.map(([label, amount], index) => ((0, jsx_runtime_1.jsxs)("span", { children: [label, " ", locked ? "•••" : formatKES(Number(amount)), index < deductionBreakdown.length - 1 && " · "] }, label))) })] }))] })] }));
}
function computeRangeDates(range, period) {
    if (range === "period") {
        return {
            start: formatNairobiParam(period.start, false),
            end: formatNairobiParam(period.end, true),
        };
    }
    if (range === "this-week") {
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - diffToMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: formatNairobiParam(weekStart, false), end: formatNairobiParam(weekEnd, true) };
    }
    if (range === "last-week") {
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - diffToMonday);
        thisWeekStart.setHours(0, 0, 0, 0);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);
        return { start: formatNairobiParam(lastWeekStart, false), end: formatNairobiParam(lastWeekEnd, true) };
    }
    return { start: "", end: "" };
}
