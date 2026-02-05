"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MarketingTrackerPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const HeaderActions_1 = __importDefault(require("@/components/HeaderActions"));
const Card_1 = __importDefault(require("@/app/_components/Card"));
const PeriodSwitcher_1 = __importDefault(require("@/app/_components/PeriodSwitcher"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const Textarea_1 = __importDefault(require("@/app/_components/Textarea"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const ReceiptsEditor_1 = __importDefault(require("@/app/_components/ReceiptsEditor"));
const toast_1 = require("@/lib/ui/toast");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingDayConfigs_1 = require("@/lib/marketingDayConfigs");
const navigation_1 = require("next/navigation");
const getLandingPage_1 = __importDefault(require("@/lib/getLandingPage"));
const marketingCommission_1 = require("@/lib/marketingCommission");
const react_2 = require("next-auth/react");
const lucide_react_1 = require("lucide-react");
const useCardLock_1 = require("@/app/_components/useCardLock");
const unpricedReceiptGrouping_1 = require("@/lib/unpricedReceiptGrouping");
const getUnpricedSaleKey = (sale) => `${sale.source}:${sale.id}`;
const getUnpricedDraftKey = (sale, receiptItemId) => receiptItemId ? `${sale.source}:item:${receiptItemId}` : getUnpricedSaleKey(sale);
const dayOptions = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
const deriveDayOfWeek = (dateStr) => {
    const d = new Date(dateStr);
    const map = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];
    const label = map[d.getDay()];
    const exists = marketingDayConfigs_1.marketingDayConfigs.find((c) => c.day === label);
    return exists?.day ?? "Monday";
};
const defaultFormState = () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const day = deriveDayOfWeek(todayStr);
    const dynamic = {};
    marketingDayConfigs_1.marketingFieldKeys.forEach((key) => {
        const type = marketingDayConfigs_1.marketingFieldTypes[key];
        dynamic[key] = type === "yesno" ? false : "";
    });
    return {
        date: todayStr,
        dayOfWeek: day,
        fields: { ...dynamic },
    };
};
const newSaleRow = () => ({
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    receiptNumber: "",
    sellingTotal: "",
    paymentMethod: "",
    items: [
        {
            id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2),
            productName: "",
            buyingPrice: "",
        },
    ],
});
const pillClass = (checked) => `rounded-full border px-4 py-2 text-sm font-medium transition ${checked
    ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"}`;
const toDateInput = (value) => value.toISOString().slice(0, 10);
const formatKES = (value) => `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const formatDateTime = (value) => {
    if (!value)
        return "-";
    return new Date(value).toLocaleString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};
// Defaults and options used by the receipts list component (must come after toDateInput)
const defaultDate = toDateInput(new Date());
const ReceiptRangeOptions = [
    { key: "today", label: "Today" },
    { key: "this-week", label: "This week" },
    { key: "period", label: "This trading period" },
    { key: "custom", label: "Custom range" },
];
// Placeholder for optional period range; populated by server or left undefined
const periodRange = undefined;
const toDateInputFromString = (value, fallback) => {
    if (!value)
        return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return fallback;
    return parsed.toISOString().slice(0, 10);
};
const getWeekBounds = (reference) => {
    const day = reference.getDay();
    const diff = (day + 6) % 7;
    const start = new Date(reference);
    start.setDate(reference.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};
function StatsCard({ periodLabel, receipts, salesKes, items, commissionKes, currentSalesForTier, nextTarget, }) {
    const hasNextTier = typeof nextTarget === "number" && nextTarget > 0;
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("marketing:quickstats");
    const mask = (val) => (locked ? "..." : val);
    const remaining = hasNextTier && nextTarget > currentSalesForTier
        ? nextTarget - currentSalesForTier
        : 0;
    const progress = hasNextTier && nextTarget
        ? Math.min((currentSalesForTier / nextTarget) * 100, 100)
        : 100;
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "h-full border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-6 flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Quick stats" }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 text-right", children: periodLabel })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(receipts) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Sales (KES)" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(salesKes.toLocaleString()) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Commission (KES)" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(commissionKes.toLocaleString()) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Items sold" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(items) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "To next tier" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs sm:text-sm text-slate-200", children: hasNextTier && remaining > 0
                            ? `KES ${remaining.toLocaleString()} more to hit next tier`
                            : "You've reached the top tier for this period!" }), (0, jsx_runtime_1.jsx)("div", { className: "h-2 w-full overflow-hidden rounded-full bg-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-emerald-500", style: { width: `${progress}%` } }) })] })] }));
}
function EarningsCard({ summary }) {
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("marketing:earnings");
    if (!summary)
        return null;
    const mask = (v) => (locked ? "..." : v);
    // Prefer explicit adjustment entries (admin-provided labels) when available.
    const adjEntries = (summary?.adjustmentEntries ?? []);
    const deductionEntries = adjEntries && adjEntries.length > 0
        ? adjEntries.filter(e => String(e.adjustmentKind || "DEDUCTION").toUpperCase() === "DEDUCTION").map(e => ({ label: e.label || e.adjustmentType, type: 'deduction', amount: e.amount }))
        : [
            { label: "Chama", type: "deduction", amount: summary.chamaTotal },
            { label: "Lateness", type: "deduction", amount: summary.latenessTotal },
            { label: "Disciplinary", type: "deduction", amount: summary.disciplineTotal },
            { label: "Other deductions", type: "deduction", amount: summary.otherDeductionsTotal },
        ];
    const rows = [
        { label: "Base salary", type: "earning", amount: summary.baseSalary },
        { label: "Commission", type: "earning", amount: summary.commission },
        { label: "Transport allowance", type: "earning", amount: summary.transportAllowance },
        { label: "Bonuses / extras", type: "earning", amount: summary.bonusTotal },
        ...deductionEntries,
    ].filter((row) => row.amount && row.amount !== 0);
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-4 flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Earnings this period" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: summary.periodLabel })] }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right text-xs", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-slate-400 uppercase tracking-wide", children: "Net pay" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xl font-semibold text-emerald-400", children: mask(`KES ${summary.netPay.toLocaleString()}`) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 text-sm", children: [summary.jenifferProgress ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-amber-600/30 bg-amber-900/5 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-amber-300", children: "Jeniffer progress" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-amber-200", children: "Next target" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm font-semibold text-amber-100", children: (summary.jenifferProgress.nextTarget ?? "—").toString() })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-amber-200", children: "Prorated earned" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm font-semibold text-amber-100", children: ["KES ", (Number(summary.jenifferProgress.prorated) ?? 0).toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-xs text-amber-300", children: ["Band progress: ", Math.round((summary.jenifferProgress.progressPercent ?? 0) * 10000) / 100, "%"] })] })) : null, rows.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-300", children: row.label }), (0, jsx_runtime_1.jsx)("span", { className: row.type === "earning"
                                    ? "font-semibold text-emerald-400"
                                    : "font-semibold text-rose-400", children: mask(`${row.type === "deduction" ? "-" : ""}KES ${row.amount.toLocaleString()}`) })] }, row.label)))] })] }));
}
function ReceiptsList({ anchorId = "receipts" }) {
    const [filters, setFilters] = (0, react_1.useState)({
        start: defaultDate,
        end: defaultDate,
        query: "",
    });
    const [rangeKey, setRangeKey] = (0, react_1.useState)("today");
    const [receipts, setReceipts] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        setFilters((prev) => ({ ...prev, start: defaultDate, end: defaultDate }));
        setRangeKey("today");
    }, [defaultDate]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const controller = new AbortController();
        const fetchReceipts = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                params.set("includeItems", "false");
                params.set("size", "40");
                params.set("start", filters.start);
                params.set("end", filters.end);
                if (filters.query.trim())
                    params.set("q", filters.query.trim());
                const res = await fetch(`/api/receipts?${params.toString()}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(data?.error || "Failed to load receipts");
                if (!cancelled) {
                    setReceipts(Array.isArray(data?.receipts) ? data.receipts : []);
                }
            }
            catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Unable to load receipts");
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        fetchReceipts();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [filters]);
    const applyRange = (key) => {
        const { start, end } = (() => {
            if (key === "today") {
                return { start: defaultDate, end: defaultDate };
            }
            if (key === "this-week") {
                const { start: weekStart, end: weekEnd } = getWeekBounds(new Date());
                return { start: toDateInput(weekStart), end: toDateInput(weekEnd) };
            }
            if (key === "period" && periodRange) {
                return {
                    start: toDateInputFromString(periodRange.start, defaultDate),
                    end: toDateInputFromString(periodRange.end, defaultDate),
                };
            }
            return { start: defaultDate, end: defaultDate };
        })();
        setFilters((prev) => ({ ...prev, start, end }));
        setRangeKey(key);
    };
    const summary = (0, react_1.useMemo)(() => {
        const totalSales = receipts.reduce((sum, receipt) => sum + Number(receipt.total ?? 0), 0);
        return {
            totalSales,
            count: receipts.length,
        };
    }, [receipts]);
    const rangeLabel = (() => {
        if (rangeKey === "today")
            return "Today";
        if (rangeKey === "this-week")
            return "This week";
        if (rangeKey === "period")
            return periodRange?.label ?? "This trading period";
        return "Custom range";
    })();
    return ((0, jsx_runtime_1.jsx)("div", { id: anchorId, className: "space-y-5", children: (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Receipts list" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-slate-100", children: "Read-only receipts history" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Explore every receipt captured across the system and filter by date, range, or attendant." })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide", children: ReceiptRangeOptions.map((option) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => applyRange(option.key), className: `rounded-full border px-4 py-1 transition ${rangeKey === option.key
                                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                                    : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"}`, children: option.label }, option.key))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 lg:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Search", (0, jsx_runtime_1.jsx)("input", { type: "search", placeholder: "Customer, attendant, receipt...", value: filters.query, onChange: (event) => setFilters((prev) => ({ ...prev, query: event.target.value })), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Start date", (0, jsx_runtime_1.jsx)("input", { type: "date", value: filters.start, onChange: (event) => {
                                        setRangeKey("custom");
                                        setFilters((prev) => {
                                            const next = { ...prev, start: event.target.value };
                                            if (next.end && next.start && next.start > next.end) {
                                                next.end = next.start;
                                            }
                                            return next;
                                        });
                                    }, className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["End date", (0, jsx_runtime_1.jsx)("input", { type: "date", value: filters.end, onChange: (event) => {
                                        setRangeKey("custom");
                                        setFilters((prev) => {
                                            const next = { ...prev, end: event.target.value };
                                            if (next.start && next.end && next.end < next.start) {
                                                next.start = next.end;
                                            }
                                            return next;
                                        });
                                    }, className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Range" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-slate-100", children: rangeLabel }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Showing receipts from ", filters.start, " to ", filters.end] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold text-emerald-300", children: summary.count }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Captured in the selected window" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Total sales" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold text-emerald-300", children: formatKES(summary.totalSales) }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Aggregated from the list below" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [loading && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Loading receipts\u2026" })), error && (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-rose-300", children: error }), !loading && !receipts.length && !error && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "No receipts found for this range." })), receipts.map((receipt) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-white", children: receipt.orderRef ?? receipt.receiptNumber ?? receipt.id }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[11px] text-slate-400", children: [receipt.attendantName ?? "Attendant unknown", " \u2022 ", formatDateTime(receipt.createdAt)] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[11px] text-slate-500", children: [receipt.customerName ?? "-", " \u2022 ", receipt.docType ?? "Receipt"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-emerald-300", children: formatKES(receipt.total) }), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/receipts/${receipt.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-xs text-emerald-300 hover:text-emerald-200", children: "View details" })] })] }, receipt.id)))] })] }) }));
}
/* ---------- Page component ---------- */
function MarketingTrackerPage() {
    const impersonateIdFromWindow = () => typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("impersonateId")
        : null;
    const [form, setForm] = (0, react_1.useState)(() => defaultFormState());
    const [receipts, setReceipts] = (0, react_1.useState)([newSaleRow()]);
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    const [weeklyMeetingAttended, setWeeklyMeetingAttended] = (0, react_1.useState)(false);
    const [weeklyVideoShootParticipated, setWeeklyVideoShootParticipated] = (0, react_1.useState)(false);
    const [weeklyVideoCount, setWeeklyVideoCount] = (0, react_1.useState)("");
    const [periodSummary, setPeriodSummary] = (0, react_1.useState)(null);
    // Background authoritative server summary used for Quick stats calculations.
    // We keep this separate from `periodSummary` which controls the visible
    // summary panel. The panel should remain hidden unless the attendant
    // explicitly submits - serverPeriodSummary is updated by the poll.
    const [serverPeriodSummary, setServerPeriodSummary] = (0, react_1.useState)(null);
    const currentPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const [selectedPeriod, setSelectedPeriod] = (0, react_1.useState)(currentPeriod);
    const selectedPeriodKey = selectedPeriod.key;
    const [earningsSummary, setEarningsSummary] = (0, react_1.useState)(null);
    const earningsSummaryJsonRef = (0, react_1.useRef)("");
    const [rawUnpricedSales, setRawUnpricedSales] = (0, react_1.useState)([]);
    const unpricedSales = (0, react_1.useMemo)(() => (0, unpricedReceiptGrouping_1.groupMarketingUnpricedSales)(rawUnpricedSales), [rawUnpricedSales]);
    const effectivePeriodRange = serverPeriodSummary?.period ?? periodSummary?.period ?? undefined;
    const [buyingDrafts, setBuyingDrafts] = (0, react_1.useState)({});
    const [currentUserEmail, setCurrentUserEmail] = (0, react_1.useState)(null);
    const [deletingSaleKey, setDeletingSaleKey] = (0, react_1.useState)(null);
    const [pricingSaleKey, setPricingSaleKey] = (0, react_1.useState)(null);
    const unpricedQueueStats = (0, react_1.useMemo)(() => {
        return unpricedSales.reduce((acc, sale) => {
            acc.receipts += 1;
            if (sale.source === "support") {
                acc.supportReceipts += 1;
                const pendingItems = sale.receiptItems?.length ?? sale.itemsPending ?? 0;
                if (pendingItems > 0) {
                    acc.items += pendingItems;
                }
                else {
                    const fallback = sale.itemsPending ?? 0;
                    acc.items += fallback > 0 ? fallback : 1;
                }
            }
            else {
                const pendingItems = (sale.groupedSaleIds?.length ?? sale.itemsPending ?? 1) || 1;
                acc.items += pendingItems;
            }
            return acc;
        }, { receipts: 0, supportReceipts: 0, items: 0 });
    }, [unpricedSales]);
    (0, react_1.useEffect)(() => {
        earningsSummaryJsonRef.current = JSON.stringify(earningsSummary ?? {});
    }, [earningsSummary]);
    const config = (0, react_1.useMemo)(() => marketingDayConfigs_1.marketingDayConfigs.find((c) => c.day === form.dayOfWeek) ??
        marketingDayConfigs_1.marketingDayConfigs[0], [form.dayOfWeek]);
    (0, react_1.useEffect)(() => {
        setForm((prev) => ({ ...prev, dayOfWeek: deriveDayOfWeek(prev.date) }));
    }, [form.date]);
    (0, react_1.useEffect)(() => {
        if (!periodSummary)
            return;
        const timer = setTimeout(() => setPeriodSummary(null), 5 * 60 * 1000);
        return () => clearTimeout(timer);
    }, [periodSummary]);
    const groupedYesNo = (0, react_1.useMemo)(() => {
        const groups = new Map();
        (config?.yesNoFields || []).forEach((f) => {
            if (!groups.has(f.section))
                groups.set(f.section, []);
            groups.get(f.section)?.push(f);
        });
        return Array.from(groups.entries());
    }, [config]);
    const router = (0, navigation_1.useRouter)();
    const handleSetBuyingDraft = (key, value) => {
        setBuyingDrafts((prev) => ({ ...prev, [key]: value }));
    };
    const allocateReceiptBuyingPrices = (total, items) => {
        const roundedTotal = Math.max(0, Math.round(total));
        if (!items.length || roundedTotal <= 0)
            return [];
        const weights = items.map((item) => Math.max(0, item.saleValue ?? 0));
        const weightSum = weights.reduce((sum, value) => sum + value, 0);
        let remainder = roundedTotal;
        const allocations = items.map((item, index) => {
            const value = weightSum > 0
                ? Math.floor((weights[index] / weightSum) * roundedTotal)
                : Math.floor(roundedTotal / items.length);
            remainder -= value;
            return { id: item.id, value };
        });
        let pointer = 0;
        while (remainder > 0 && allocations.length > 0) {
            allocations[pointer % allocations.length].value += 1;
            remainder -= 1;
            pointer += 1;
        }
        return allocations;
    };
    const submitBuyingPrice = async (sale, receiptItemId, buyingPrice, options) => {
        if (sale.source === "support" && !receiptItemId) {
            throw new Error("Select an item on the receipt to price");
        }
        const targetSaleId = options?.overrideSaleId ?? sale.id;
        const endpoint = sale.source === "support" ? "/api/support/price-sale" : "/api/marketing/price-sale";
        const body = sale.source === "support"
            ? { receiptItemId, buyingPrice }
            : { dailySaleId: targetSaleId, buyingPrice };
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.error || "Failed to save buying price");
        }
        const data = await res.json().catch(() => null);
        let saleValueDelta = 0;
        let paymentDelta = null;
        setRawUnpricedSales((prev) => {
            const next = [];
            for (const row of prev) {
                if (row.id !== targetSaleId || row.source !== sale.source) {
                    next.push(row);
                    continue;
                }
                if (row.source === "support" && receiptItemId) {
                    const remainingItems = (row.receiptItems || []).filter((item) => item.id !== receiptItemId);
                    if (!remainingItems.length) {
                        saleValueDelta = data?.receiptTotal ?? row.sellingPrice;
                        paymentDelta = row.paymentMethod;
                        continue;
                    }
                    next.push({
                        ...row,
                        receiptItems: remainingItems,
                        itemsPending: Math.max(0, (row.itemsPending ?? remainingItems.length + 1) - 1),
                    });
                    continue;
                }
                saleValueDelta = options?.saleValue ?? data?.saleValue ?? row.sellingPrice;
                paymentDelta = row.paymentMethod;
            }
            return next;
        });
        if (saleValueDelta > 0) {
            const methodKey = paymentDelta === "CASH" ? "totalSalesCash" : "totalSalesMpesa";
            setServerPeriodSummary((prev) => {
                if (!prev)
                    return prev;
                const updatedPaymentStats = {
                    ...prev.aggregates.paymentStats,
                    [methodKey]: (prev.aggregates.paymentStats[methodKey] ?? 0) + saleValueDelta,
                };
                return {
                    ...prev,
                    aggregates: {
                        ...prev.aggregates,
                        totalSales: prev.aggregates.totalSales + saleValueDelta,
                        totalItems: prev.aggregates.totalItems + 1,
                        paymentStats: updatedPaymentStats,
                    },
                };
            });
            try {
                setEarningsSummary((prev) => {
                    if (!prev)
                        return prev;
                    const currentTotalSales = serverPeriodSummary?.aggregates?.totalSales ?? 0;
                    const newTotalSales = currentTotalSales + saleValueDelta;
                    const commissionInfo = (0, marketingCommission_1.getCommissionSummaryForSales)(newTotalSales);
                    const newCommission = Math.round(commissionInfo.commission ?? 0);
                    const delta = newCommission - (prev.commission ?? 0);
                    if (delta === 0)
                        return { ...prev, commission: newCommission };
                    return {
                        ...prev,
                        commission: newCommission,
                        totalEarnings: (prev.totalEarnings ?? 0) + delta,
                        netPay: (prev.netPay ?? 0) + delta,
                    };
                });
            }
            catch {
                // ignore client-side calculation issues
            }
        }
    };
    const handleSubmitBuyingPrice = async (sale, receiptItemId) => {
        const draftKey = getUnpricedDraftKey(sale, receiptItemId);
        const rawValue = buyingDrafts[draftKey] ?? "";
        const parsedValue = Number(rawValue);
        if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "error");
            return;
        }
        const buyingPrice = Math.round(parsedValue);
        setPricingSaleKey(draftKey);
        try {
            await submitBuyingPrice(sale, receiptItemId, buyingPrice);
            setBuyingDrafts((prev) => {
                const next = { ...prev };
                delete next[draftKey];
                return next;
            });
            (0, toast_1.showToast)("Buying price saved", "success");
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to save buying price", "error");
        }
        finally {
            setPricingSaleKey(null);
        }
    };
    const handleSubmitSupportReceiptTotal = async (sale) => {
        const draftKey = getUnpricedDraftKey(sale);
        const rawValue = buyingDrafts[draftKey] ?? "";
        const parsedValue = Number(rawValue);
        if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "error");
            return;
        }
        const items = sale.receiptItems || [];
        if (!items.length) {
            (0, toast_1.showToast)("No receipt items available for pricing", "error");
            return;
        }
        const allocations = allocateReceiptBuyingPrices(Math.round(parsedValue), items);
        setPricingSaleKey(draftKey);
        try {
            for (let i = 0; i < allocations.length; i++) {
                const { id, value } = allocations[i];
                await submitBuyingPrice(sale, id, value);
            }
            setBuyingDrafts((prev) => {
                const next = { ...prev };
                delete next[draftKey];
                return next;
            });
            (0, toast_1.showToast)("Buying price saved", "success");
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to save buying price", "error");
        }
        finally {
            setPricingSaleKey(null);
        }
    };
    const handleSubmitMarketingReceiptTotal = async (sale) => {
        const draftKey = getUnpricedDraftKey(sale);
        const rawValue = buyingDrafts[draftKey] ?? "";
        const parsedValue = Number(rawValue);
        if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "error");
            return;
        }
        const items = sale.receiptItems ?? [];
        if (!items.length) {
            (0, toast_1.showToast)("No receipt items available for pricing", "error");
            return;
        }
        const allocations = allocateReceiptBuyingPrices(Math.round(parsedValue), items);
        setPricingSaleKey(draftKey);
        try {
            for (const { id, value } of allocations) {
                const entry = items.find((item) => item.id === id);
                await submitBuyingPrice(sale, undefined, value, {
                    overrideSaleId: id,
                    saleValue: entry?.saleValue,
                });
            }
            setBuyingDrafts((prev) => {
                const next = { ...prev };
                delete next[draftKey];
                return next;
            });
            (0, toast_1.showToast)("Buying price saved", "success");
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to save buying price", "error");
        }
        finally {
            setPricingSaleKey(null);
        }
    };
    const handleDeleteUnpricedSale = async (sale) => {
        const key = getUnpricedSaleKey(sale);
        if (typeof window !== "undefined") {
            const confirmed = window.confirm("Delete this pending sale? This cannot be undone.");
            if (!confirmed)
                return;
        }
        setDeletingSaleKey(key);
        try {
            const ids = sale.source === "daily-sale" && sale.groupedSaleIds?.length
                ? sale.groupedSaleIds
                : [sale.id];
            for (const saleId of ids) {
                const res = await fetch("/api/marketing/unpriced-sales/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({ saleId, source: sale.source }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    (0, toast_1.showToast)(err?.error || "Failed to delete sale", "error");
                    return;
                }
            }
            setRawUnpricedSales((prev) => prev.filter((row) => !(sale.groupedSaleIds ?? [sale.id]).includes(row.id)));
            setBuyingDrafts((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            (0, toast_1.showToast)("Sale deleted", "success");
        }
        catch {
            (0, toast_1.showToast)("Failed to delete sale", "error");
        }
        finally {
            setDeletingSaleKey((prev) => (prev === key ? null : prev));
        }
    };
    // auth guard
    (0, react_1.useEffect)(() => {
        (async () => {
            try {
                const imp = impersonateIdFromWindow();
                const url = imp
                    ? `/api/attendants/me?impersonateId=${encodeURIComponent(imp)}`
                    : "/api/attendants/me";
                const res = await fetch(url, { credentials: "same-origin" });
                if (!res.ok) {
                    try {
                        const cb = typeof window !== "undefined" ? window.location.pathname : "/marketing/tracker";
                        router.replace(`/attendant/login?callbackUrl=${encodeURIComponent(cb)}`);
                    }
                    catch (e) {
                        router.replace("/attendant/login");
                    }
                    return;
                }
                const data = await res.json().catch(() => null);
                const user = data?.user;
                if (!user) {
                    try {
                        const cb = typeof window !== "undefined" ? window.location.pathname : "/marketing/tracker";
                        router.replace(`/attendant/login?callbackUrl=${encodeURIComponent(cb)}`);
                    }
                    catch (e) {
                        router.replace("/attendant/login");
                    }
                    return;
                }
                setCurrentUserEmail(user.email?.toLowerCase() ?? null);
                const role = user.role;
                const category = user.attendantCategory;
                if (role === "ADMIN")
                    return;
                if (category !== "DIRECT_SALES_OPS") {
                    const dest = (0, getLandingPage_1.default)(category ?? null, role);
                    router.replace(dest);
                }
            }
            catch {
                try {
                    const cb = typeof window !== "undefined" ? window.location.pathname : "/marketing/tracker";
                    router.replace(`/attendant/login?callbackUrl=${encodeURIComponent(cb)}`);
                }
                catch (e) {
                    router.replace("/attendant/login");
                }
            }
        })();
    }, [router]);
    // fetch + poll period summary so Quick stats stay in sync with server
    (0, react_1.useEffect)(() => {
        const POLL_INTERVAL_MS = 15000; // poll every 15s
        const controller = new AbortController();
        const buildSummaryFrom = (data) => {
            const paymentStatsRaw = data.aggregates?.paymentStats ?? {};
            return {
                period: {
                    key: data.period?.key ?? "",
                    label: data.period?.label ?? "",
                    start: data.period?.start ?? "",
                    end: data.period?.end ?? "",
                },
                aggregates: {
                    totalSales: data.aggregates?.totalSales ?? 0,
                    totalItems: data.aggregates?.totalItems ?? 0,
                    paymentStats: {
                        totalSalesMpesa: paymentStatsRaw.totalSalesMpesa ?? 0,
                        totalSalesCash: paymentStatsRaw.totalSalesCash ?? 0,
                        countMpesaReceipts: paymentStatsRaw.countMpesaReceipts ?? 0,
                        countCashReceipts: paymentStatsRaw.countCashReceipts ?? 0,
                    },
                    commission: {
                        commission: data.aggregates?.commission?.commission ?? 0,
                    },
                },
            };
        };
        const fetchSummary = async () => {
            try {
                if (typeof document !== "undefined" && document.visibilityState === "hidden")
                    return;
                const imp = impersonateIdFromWindow();
                const params = new URLSearchParams({ periodKey: selectedPeriodKey });
                if (imp) {
                    params.set("impersonateId", imp);
                }
                const url = `/api/marketing/report/summary?${params.toString()}`;
                const res = await fetch(url, {
                    credentials: "same-origin",
                    signal: controller.signal,
                    cache: "no-store",
                });
                if (!res.ok)
                    return;
                const data = await res.json().catch(() => null);
                if (!data)
                    return;
                const next = buildSummaryFrom(data);
                const safeNext = {
                    ...next,
                    aggregates: {
                        ...next.aggregates,
                        paymentStats: {
                            totalSalesMpesa: next.aggregates.paymentStats.totalSalesMpesa ?? 0,
                            totalSalesCash: next.aggregates.paymentStats.totalSalesCash ?? 0,
                            countMpesaReceipts: next.aggregates.paymentStats.countMpesaReceipts ?? 0,
                            countCashReceipts: next.aggregates.paymentStats.countCashReceipts ?? 0,
                        },
                    },
                };
                // update authoritative server-side summary but do NOT show the panel
                // unless the attendant explicitly submitted (periodSummary is used
                // for the visible panel). This keeps Quick stats accurate while the
                // panel remains hidden.
                setServerPeriodSummary((prev) => {
                    if (!prev)
                        return safeNext;
                    const changed = prev.aggregates.totalSales !== safeNext.aggregates.totalSales ||
                        prev.aggregates.totalItems !== safeNext.aggregates.totalItems ||
                        prev.aggregates.paymentStats.totalSalesMpesa !== safeNext.aggregates.paymentStats.totalSalesMpesa ||
                        prev.aggregates.paymentStats.totalSalesCash !== safeNext.aggregates.paymentStats.totalSalesCash ||
                        prev.aggregates.commission.commission !== safeNext.aggregates.commission.commission ||
                        prev.period.label !== safeNext.period.label;
                    return changed ? safeNext : prev;
                });
            }
            catch {
                // ignore network/abort errors
            }
        };
        // initial fetch
        fetchSummary();
        const id = setInterval(fetchSummary, POLL_INTERVAL_MS);
        return () => {
            clearInterval(id);
            controller.abort();
        };
    }, [selectedPeriodKey]);
    // Poll earnings summary for the current attendant (used by EarningsCard)
    (0, react_1.useEffect)(() => {
        const POLL_INTERVAL_MS = 15000;
        const controller = new AbortController();
        const fetchEarnings = async () => {
            try {
                if (typeof document !== "undefined" && document.visibilityState === "hidden")
                    return;
                const imp = impersonateIdFromWindow();
                const url = imp
                    ? `/api/marketing/earnings/summary?impersonateId=${encodeURIComponent(imp)}`
                    : "/api/marketing/earnings/summary";
                const res = await fetch(url, { credentials: "same-origin", signal: controller.signal });
                if (!res.ok)
                    return;
                const data = await res.json().catch(() => null);
                if (!data)
                    return;
                const next = data.summary ?? null;
                // shallow compare by JSON to avoid unnecessary updates
                const prevStr = earningsSummaryJsonRef.current;
                const nextStr = JSON.stringify(next ?? {});
                if (next && prevStr !== nextStr) {
                    earningsSummaryJsonRef.current = nextStr;
                    setEarningsSummary(next);
                }
            }
            catch {
                // ignore network/abort errors
            }
        };
        fetchEarnings();
        const id = setInterval(fetchEarnings, POLL_INTERVAL_MS);
        return () => {
            clearInterval(id);
            controller.abort();
        };
    }, []);
    (0, react_1.useEffect)(() => {
        const POLL_INTERVAL_MS = 20000;
        if (!currentUserEmail || currentUserEmail !== "jeniffer@betech.co.ke") {
            setRawUnpricedSales([]);
            return;
        }
        const controller = new AbortController();
        const fetchUnpricedSales = async () => {
            try {
                if (typeof document !== "undefined" && document.visibilityState === "hidden")
                    return;
                const res = await fetch("/api/marketing/unpriced-sales", {
                    credentials: "same-origin",
                    signal: controller.signal,
                });
                if (!res.ok)
                    return;
                const data = await res.json().catch(() => null);
                if (!data?.sales)
                    return;
                setRawUnpricedSales(data.sales);
            }
            catch {
                // ignore expected aborts/errors
            }
        };
        fetchUnpricedSales();
        const id = setInterval(fetchUnpricedSales, POLL_INTERVAL_MS);
        return () => {
            clearInterval(id);
            controller.abort();
        };
    }, [currentUserEmail]);
    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
    };
    const totals = (0, react_1.useMemo)(() => {
        const totalSales = receipts.reduce((sum, r) => sum +
            (typeof r.sellingTotal === "number"
                ? r.sellingTotal
                : Number(r.sellingTotal || 0)), 0);
        const totalProfit = receipts.reduce((sum, r) => {
            const selling = typeof r.sellingTotal === "number" ? r.sellingTotal : Number(r.sellingTotal || 0);
            // If any item in the receipt does not have a buyingPrice entered,
            // treat the receipt as unpriced and exclude it from profit calculations.
            const allItemsPriced = r.items.every((it) => {
                if (typeof it.buyingPrice === "number")
                    return it.buyingPrice > 0;
                return Number(it.buyingPrice || 0) > 0;
            });
            if (!allItemsPriced)
                return sum;
            const buyingSum = r.items.reduce((s, it) => s + (typeof it.buyingPrice === "number" ? it.buyingPrice : Number(it.buyingPrice || 0)), 0);
            return sum + (selling - buyingSum);
        }, 0);
        // Count only "filled" items (product name or a buying price) so the
        // items counter updates as the attendant types product names/prices.
        const totalItems = receipts.reduce((sum, r) => {
            const filled = r.items.filter((it) => {
                const nameFilled = typeof it.productName === "string" && it.productName.trim() !== "";
                const priceFilled = typeof it.buyingPrice === "number"
                    ? it.buyingPrice > 0
                    : Number(it.buyingPrice || 0) > 0;
                return nameFilled || priceFilled;
            }).length;
            return sum + filled;
        }, 0);
        // Count only "filled" receipts (sellingTotal > 0, any filled item, or
        // a non-empty receipt number) so the receipts counter updates while
        // typing, similar to total sales.
        const filledReceiptsCount = receipts.reduce((count, r) => {
            const hasSelling = typeof r.sellingTotal === "number"
                ? r.sellingTotal > 0
                : Number(r.sellingTotal || 0) > 0;
            const hasItems = r.items.some((it) => {
                const nameFilled = typeof it.productName === "string" && it.productName.trim() !== "";
                const priceFilled = typeof it.buyingPrice === "number"
                    ? it.buyingPrice > 0
                    : Number(it.buyingPrice || 0) > 0;
                return nameFilled || priceFilled;
            });
            const hasReceiptNumber = (r.receiptNumber ?? "").trim() !== "";
            return count + (hasSelling || hasItems || hasReceiptNumber ? 1 : 0);
        }, 0);
        return { totalSales, totalProfit, totalItems, filledReceiptsCount };
    }, [receipts]);
    // derived stats for the Quick stats card
    const totalReceipts = totals.filledReceiptsCount ?? receipts.length;
    const totalSales = totals.totalSales;
    const totalItems = totals.totalItems;
    // Combine server-side period totals (if any) with the unsaved local receipts
    // so the Quick stats update instantly as the attendant enters or deletes sales.
    // Use `serverPeriodSummary` (authoritative) for calculations so the visible
    // panel (`periodSummary`) can remain hidden while Quick stats stay accurate.
    const serverPeriodTotalSales = serverPeriodSummary?.aggregates?.totalSales ?? 0;
    const combinedPeriodSales = serverPeriodTotalSales + totalSales;
    const serverPeriodTotalItems = serverPeriodSummary?.aggregates?.totalItems ?? 0;
    const combinedPeriodItems = serverPeriodTotalItems + totalItems;
    // receipts: server may provide counts per payment method in paymentStats
    const serverPeriodReceipts = (serverPeriodSummary?.aggregates?.paymentStats?.countMpesaReceipts ?? 0) +
        (serverPeriodSummary?.aggregates?.paymentStats?.countCashReceipts ?? 0);
    const combinedPeriodReceipts = serverPeriodReceipts + totalReceipts;
    const commissionSummary = (0, react_1.useMemo)(() => (0, marketingCommission_1.getCommissionSummaryForSales)(combinedPeriodSales), [combinedPeriodSales]);
    // Prefer the server-calculated earnings summary commission when available
    // so the Quick stats panel matches the detailed Earnings card exactly.
    const commissionKes = earningsSummary?.commission ?? commissionSummary.commission;
    const nextTarget = commissionSummary.nextTarget;
    const periodLabel = periodSummary?.period.label ??
        serverPeriodSummary?.period.label ??
        selectedPeriod.label ??
        "Loading current period\u2026";
    const displayedSalesKes = combinedPeriodSales;
    const displayedItems = combinedPeriodItems;
    const displayedReceipts = combinedPeriodReceipts;
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const errors = [];
        receipts.forEach((r, i) => {
            if (!r.receiptNumber || r.receiptNumber.trim() === "")
                errors.push(`Receipt ${i + 1}: missing receipt number`);
            if (r.sellingTotal === "" || Number.isNaN(Number(r.sellingTotal)))
                errors.push(`Receipt ${i + 1}: invalid selling total`);
            if (!r.paymentMethod)
                errors.push(`Receipt ${i + 1}: missing payment method`);
            r.items.forEach((it, j) => {
                if (!it.productName || it.productName.trim() === "")
                    errors.push(`Receipt ${i + 1}, item ${j + 1}: missing product name`);
                if (it.buyingPrice === "" || Number.isNaN(Number(it.buyingPrice)))
                    errors.push(`Receipt ${i + 1}, item ${j + 1}: invalid buying price`);
            });
        });
        (config.textFields || []).forEach((f) => {
            const raw = form.fields[f.key];
            if (!raw || String(raw).trim() === "")
                errors.push(`${f.key}: required`);
        });
        (config.numericFields || []).forEach((f) => {
            const raw = form.fields[f.key];
            if (raw === "" ||
                raw === null ||
                raw === undefined ||
                Number.isNaN(Number(raw)))
                errors.push(`${f.key}: required numeric`);
        });
        if (errors.length > 0) {
            (0, toast_1.showToast)(errors.slice(0, 5).join("; "), "error");
            setSubmitting(false);
            return;
        }
        try {
            const yesNo = {};
            const numeric = {};
            const text = {};
            Object.entries(marketingDayConfigs_1.marketingFieldTypes).forEach(([key, type]) => {
                const raw = form.fields[key];
                if (type === "yesno")
                    yesNo[key] = Boolean(raw);
                else if (type === "numeric")
                    numeric[key] = Number(raw || 0);
                else
                    text[key] = typeof raw === "string" ? raw : "";
            });
            const payload = {
                date: form.date,
                dayOfWeek: form.dayOfWeek,
                receipts: receipts.map((r) => ({
                    receiptNumber: r.receiptNumber,
                    sellingTotal: r.sellingTotal === "" ? 0 : Math.max(0, Number(r.sellingTotal)),
                    paymentMethod: r.paymentMethod,
                    items: r.items.map((it) => ({
                        productName: it.productName.trim(),
                        buyingPrice: it.buyingPrice === "" ? 0 : Math.max(0, Number(it.buyingPrice)),
                    })),
                })),
                yesNo,
                numeric,
                text,
                weeklyMeetingAttended,
                weeklyVideoShootParticipated,
                weeklyVideoCount: weeklyVideoCount ? Number(weeklyVideoCount) : 0,
            };
            const imp = impersonateIdFromWindow();
            const url = imp
                ? `/api/marketing/daily?impersonateId=${encodeURIComponent(imp)}`
                : "/api/marketing/daily";
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                (0, toast_1.showToast)("Marketing daily tracker submitted", "success");
                setForm(defaultFormState());
                setReceipts([newSaleRow()]);
                setWeeklyMeetingAttended(false);
                setWeeklyVideoShootParticipated(false);
                setWeeklyVideoCount("");
                const data = await res.json().catch(() => null);
                if (data?.periodSummary) {
                    // Use authoritative receipt counts returned by the server so Quick
                    // stats show exact MPESA/CASH/total receipts immediately after submit.
                    const next = {
                        period: {
                            key: "",
                            label: data.periodSummary.periodLabel,
                            start: "",
                            end: "",
                        },
                        aggregates: {
                            totalSales: data.periodSummary.periodSales ?? 0,
                            totalItems: data.periodSummary.totalItems ?? 0,
                            paymentStats: {
                                totalSalesMpesa: data.periodSummary.mpesaTotal ?? 0,
                                totalSalesCash: data.periodSummary.cashTotal ?? 0,
                                countMpesaReceipts: data.periodSummary.countMpesaReceipts ?? 0,
                                countCashReceipts: data.periodSummary.countCashReceipts ?? 0,
                            },
                            commission: {
                                commission: data.periodSummary.commission ?? 0,
                            },
                        },
                    };
                    // show the panel briefly
                    setPeriodSummary(next);
                    // also update the background authoritative summary used by Quick stats
                    setServerPeriodSummary(next);
                }
            }
            else {
                const err = await res.json().catch(() => ({}));
                (0, toast_1.showToast)(err.error || "Failed to submit entry", "error");
            }
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to submit entry", "error");
        }
        finally {
            setSubmitting(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, className: "mx-auto flex max-w-6xl flex-col gap-6 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Sales Operations Dashboard" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Every task you complete brings you closer to your next reward." })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: (0, jsx_runtime_1.jsx)(HeaderActions_1.default, { receiptsHref: "/marketing/receipts", createHref: `/receipts?start=${form.date}&end=${form.date}`, onSignOut: () => (0, react_2.signOut)({ callbackUrl: "/attendant/login" }), showDot: false }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Statistics period" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-slate-100", children: selectedPeriod.label }), selectedPeriodKey !== currentPeriod.key && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-amber-300", children: "Showing archived period." }))] }), (0, jsx_runtime_1.jsx)(PeriodSwitcher_1.default, { currentPeriod: currentPeriod, selectedPeriod: selectedPeriod, onSelectPeriod: setSelectedPeriod })] }) }), periodSummary && ((0, jsx_runtime_1.jsx)(Card_1.default, { className: "border-emerald-700/60 bg-emerald-900/20 text-emerald-100 shadow-xl shadow-emerald-900/30", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Summary so far for this trading period" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: periodSummary.period.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-emerald-200", children: periodSummary.period.label })] }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", onClick: () => setPeriodSummary(null), children: "Hide" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Period sales" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xl font-semibold text-white", children: ["KES ", periodSummary.aggregates.totalSales.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Total items" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: periodSummary.aggregates.totalItems.toLocaleString() })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "MPESA vs Cash" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm", children: ["MPESA KES", " ", periodSummary.aggregates.paymentStats.totalSalesMpesa.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm", children: ["Cash KES", " ", periodSummary.aggregates.paymentStats.totalSalesCash.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Commission so far" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xl font-semibold text-white", children: ["KES", " ", periodSummary.aggregates.commission.commission.toLocaleString()] })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-emerald-200", children: "This panel auto-hides after 5 minutes. Commission shown is cumulative for the current trading period." })] }) })), (0, jsx_runtime_1.jsx)(Card_1.default, { className: "border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20", children: (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Date" }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-3", children: (0, jsx_runtime_1.jsx)(Input_1.default, { type: "date", value: form.date, onChange: (e) => setForm((prev) => ({ ...prev, date: e.target.value })), className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Day of week" }), (0, jsx_runtime_1.jsx)("select", { value: form.dayOfWeek, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            dayOfWeek: e.target.value,
                                        })), className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100", children: dayOptions.map((day) => ((0, jsx_runtime_1.jsx)("option", { value: day, children: day }, day))) })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-12 items-start", children: [(0, jsx_runtime_1.jsx)("div", { className: "lg:col-span-8", children: (0, jsx_runtime_1.jsx)(ReceiptsEditor_1.default, { receipts: receipts, setReceipts: setReceipts, totals: totals }) }), (0, jsx_runtime_1.jsxs)("div", { className: "lg:col-span-4 space-y-4", children: [(0, jsx_runtime_1.jsx)(StatsCard, { periodLabel: periodLabel, receipts: displayedReceipts, salesKes: displayedSalesKes, items: displayedItems, commissionKes: commissionKes, currentSalesForTier: combinedPeriodSales, nextTarget: nextTarget }), (0, jsx_runtime_1.jsx)(EarningsCard, { summary: earningsSummary }), currentUserEmail === "jeniffer@betech.co.ke" && ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-sm font-semibold text-slate-100", children: "Sales needing buying price" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Attach buying price to attendants' sales to earn commission." })] }), unpricedSales.length > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-start rounded-xl border border-slate-800/80 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-300 sm:flex-row sm:items-center sm:gap-4", children: [(0, jsx_runtime_1.jsxs)("span", { children: [unpricedQueueStats.receipts, " receipts"] }), (0, jsx_runtime_1.jsxs)("span", { children: [unpricedQueueStats.items, " items pending"] }), unpricedQueueStats.supportReceipts ? ((0, jsx_runtime_1.jsxs)("span", { children: [unpricedQueueStats.supportReceipts, " support receipts"] })) : null] })) : null] }), unpricedSales.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "No pending sales. All sales in this period have buying prices." })) : ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 space-y-2 max-h-72 overflow-y-auto pr-1", children: unpricedSales.map((sale) => {
                                                const saleKey = getUnpricedSaleKey(sale);
                                                const isSupport = sale.source === "support";
                                                const receiptItems = sale.receiptItems;
                                                const hasReceiptItems = (receiptItems?.length ?? 0) > 0;
                                                const isDeleting = deletingSaleKey === saleKey;
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/70 px-3 py-2 text-xs space-y-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-slate-100", children: sale.productName }), (0, jsx_runtime_1.jsx)("span", { className: "rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400", children: isSupport ? "Support ops" : "Marketing ops" })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDeleteUnpricedSale(sale), disabled: isDeleting, "aria-label": "Delete pending sale", title: "Delete sale", className: `rounded-full p-1 text-slate-500 transition hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50`, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between gap-2 text-[11px] text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: sale.attendantName }), (0, jsx_runtime_1.jsxs)("span", { children: ["#", sale.receiptNumber || "No receipt", " - ", sale.paymentMethod || "N/A"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-[11px] text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: hasReceiptItems ? "Receipt value" : "Line value" }), (0, jsx_runtime_1.jsxs)("span", { children: ["KES ", sale.sellingPrice.toLocaleString()] })] }), hasReceiptItems ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-[10px] uppercase tracking-wide text-slate-500", children: [((sale.itemsPending ?? sale.receiptItems?.length ?? 0) || 0).toLocaleString(), " pending", sale.itemsTotal ? ` of ${sale.itemsTotal}` : "", " items"] })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-[10px] uppercase tracking-wide text-slate-500", children: "1 item pending" })), hasReceiptItems ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 pt-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-[11px] text-slate-300", children: (0, jsx_runtime_1.jsx)("ul", { className: "list-disc space-y-1 pl-4 text-left text-slate-200", children: receiptItems.map((item) => ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsx)("span", { children: item.productName || "Receipt item" }), typeof item.saleValue === "number" ? ((0, jsx_runtime_1.jsxs)("span", { className: "text-slate-400", children: ["KES ", item.saleValue.toLocaleString()] })) : null] }, item.id))) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, placeholder: "Total buying price", value: buyingDrafts[saleKey] ?? "", onChange: (e) => handleSetBuyingDraft(saleKey, e.target.value), className: "h-8 w-28 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => isSupport
                                                                                ? handleSubmitSupportReceiptTotal(sale)
                                                                                : handleSubmitMarketingReceiptTotal(sale), disabled: pricingSaleKey === saleKey, className: "ml-auto h-8 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-60", children: pricingSaleKey === saleKey ? "Saving." : "Save" })] })] })) : ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 pt-1", children: [(0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, placeholder: "Buying price", value: buyingDrafts[saleKey] ?? "", onChange: (e) => handleSetBuyingDraft(saleKey, e.target.value), className: "h-8 w-24 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleSubmitBuyingPrice(sale), className: "ml-auto h-8 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black hover:brightness-95", children: "Save" })] }))] }, saleKey));
                                            }) }))] }))] })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-4 flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Day checklist" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: config.day })] }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200", children: "Auto-loaded from selected day" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [groupedYesNo.map(([section, fields]) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between", children: (0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-slate-200", children: section }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: fields.map((f) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateField(f.key, !Boolean(form.fields[f.key])), className: pillClass(Boolean(form.fields[f.key])), children: f.label }, f.key))) })] }, section))), form.dayOfWeek === "Thursday" && ((0, jsx_runtime_1.jsxs)("section", { className: "mt-6 rounded-xl border border-red-500/30 p-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "mb-3 text-sm font-semibold", children: "Weekly Marketing Activities (Thursday)" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Weekly meeting" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                                            setWeeklyMeetingAttended(true);
                                                                            updateField("weeklyMeetingAttended", true);
                                                                        }, className: pillClass(weeklyMeetingAttended), children: "Attended weekly marketing meeting" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                                            setWeeklyMeetingAttended(false);
                                                                            updateField("weeklyMeetingAttended", false);
                                                                        }, className: pillClass(!weeklyMeetingAttended), children: "Did not attend" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Video shoot" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                                            setWeeklyVideoShootParticipated(true);
                                                                            updateField("weeklyVideoShootParticipated", true);
                                                                        }, className: pillClass(weeklyVideoShootParticipated), children: "Participated in weekly video shoot" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                                            setWeeklyVideoShootParticipated(false);
                                                                            updateField("weeklyVideoShootParticipated", false);
                                                                        }, className: pillClass(!weeklyVideoShootParticipated), children: "Did not participate" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Number of videos participated in (shooting)" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2", children: (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, value: String(weeklyVideoCount), onChange: (e) => {
                                                                        const v = e.target.value === ""
                                                                            ? ""
                                                                            : Math.max(0, Number(e.target.value));
                                                                        setWeeklyVideoCount(v === "" ? "" : Number(v));
                                                                        updateField("weeklyVideoCount", v === "" ? "" : Number(v));
                                                                    }, className: "w-28 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-center text-slate-100" }) })] }) })] })] })), (config.numericFields || []).length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-slate-200", children: "Numeric checks" }), (0, jsx_runtime_1.jsx)("div", { className: "grid gap-3 md:grid-cols-2", children: (config.numericFields || []).map((f) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: f.label }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: f.min, value: String(form.fields[f.key] ?? ""), onChange: (e) => updateField(f.key, e.target.value), className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" })] }, f.key))) })] })), (config.textFields || []).length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-slate-200", children: "Notes" }), (0, jsx_runtime_1.jsx)("div", { className: "grid gap-3", children: (config.textFields || []).map((f) => ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: f.label }), (0, jsx_runtime_1.jsx)(Textarea_1.default, { value: String(form.fields[f.key] ?? ""), onChange: (e) => updateField(f.key, e.target.value), placeholder: f.placeholder, rows: 3, className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" })] }, f.key))) })] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 backdrop-blur", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { type: "reset", variant: "secondary", onClick: () => setForm(defaultFormState()), className: "px-5", children: "Reset" }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "submit", variant: "primary", className: "bg-emerald-500 px-5 text-black hover:brightness-95", disabled: submitting, children: submitting ? "Submitting..." : "Submit report" })] })] }) }));
}
