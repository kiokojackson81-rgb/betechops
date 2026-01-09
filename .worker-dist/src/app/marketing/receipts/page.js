"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MarketingReceiptsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const toDateInput = (value) => value.toISOString().slice(0, 10);
const formatKES = (value) => `KES ${Number(value ?? 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
})}`;
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
const toStartOfDayIso = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
};
const toEndOfDayIso = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    date.setUTCHours(23, 59, 59, 999);
    return date.toISOString();
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
const ReceiptRangeOptions = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "this-week", label: "This week" },
    { key: "period", label: "This period" },
];
function MarketingReceiptsPage() {
    const defaultDate = toDateInput(new Date());
    const tradingPeriod = (0, react_1.useMemo)(() => (0, tradingPeriod_1.getTradingPeriodFor)(new Date()), []);
    const periodRange = (0, react_1.useMemo)(() => ({
        start: toDateInput(tradingPeriod.start),
        end: toDateInput(tradingPeriod.end),
        label: tradingPeriod.label,
    }), [tradingPeriod]);
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
                params.set("size", "80");
                const startIso = toStartOfDayIso(filters.start);
                const endIso = toEndOfDayIso(filters.end);
                if (startIso)
                    params.set("start", startIso);
                if (endIso)
                    params.set("end", endIso);
                if (filters.query.trim()) {
                    params.set("q", filters.query.trim());
                }
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
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        fetchReceipts();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [filters]);
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
        if (rangeKey === "yesterday")
            return "Yesterday";
        if (rangeKey === "this-week")
            return "This week";
        if (rangeKey === "period")
            return periodRange.label;
        return "Custom range";
    })();
    const applyRange = (key) => {
        const { start, end } = (() => {
            if (key === "today") {
                return { start: defaultDate, end: defaultDate };
            }
            if (key === "yesterday") {
                const today = new Date(defaultDate);
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const yesterdayInput = toDateInput(yesterday);
                return { start: yesterdayInput, end: yesterdayInput };
            }
            if (key === "this-week") {
                const { start: weekStart, end: weekEnd } = getWeekBounds(new Date());
                return { start: toDateInput(weekStart), end: toDateInput(weekEnd) };
            }
            if (key === "period") {
                return { start: periodRange.start, end: periodRange.end };
            }
            return { start: defaultDate, end: defaultDate };
        })();
        setFilters((prev) => ({ ...prev, start, end }));
        setRangeKey(key);
    };
    const handleStartChange = (value) => {
        setRangeKey("custom");
        setFilters((prev) => {
            const next = { ...prev, start: value };
            if (next.end && next.start > next.end) {
                next.end = next.start;
            }
            return next;
        });
    };
    const handleEndChange = (value) => {
        setRangeKey("custom");
        setFilters((prev) => {
            const next = { ...prev, end: value };
            if (next.start && next.end && next.end < next.start) {
                next.start = next.end;
            }
            return next;
        });
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsxs)("main", { className: "mx-auto max-w-5xl space-y-6 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Receipts history" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Browse every receipt captured in the system. Use the range pills or custom dates to narrow the window." })] }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/marketing/tracker", className: "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10", children: "Back to dashboard" })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Receipts list" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-slate-100", children: "Read-only receipts history" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Explore every receipt captured across the system and filter by date, range, or attendant." })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide", children: ReceiptRangeOptions.map((option) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => applyRange(option.key), className: `rounded-full border px-4 py-1 transition ${rangeKey === option.key
                                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                                            : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"}`, children: option.label }, option.key))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 lg:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Search", (0, jsx_runtime_1.jsx)("input", { type: "search", placeholder: "Customer, attendant, receipt...", value: filters.query, onChange: (event) => setFilters((prev) => ({ ...prev, query: event.target.value })), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Start date", (0, jsx_runtime_1.jsx)("input", { type: "date", value: filters.start, onChange: (event) => handleStartChange(event.target.value), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["End date", (0, jsx_runtime_1.jsx)("input", { type: "date", value: filters.end, onChange: (event) => handleEndChange(event.target.value), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Range" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-slate-100", children: rangeLabel }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Showing receipts from ", filters.start, " to ", filters.end] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold text-emerald-300", children: summary.count }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Captured in the selected window" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Total sales" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold text-emerald-300", children: formatKES(summary.totalSales) }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Aggregated from the receipts below" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [loading && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Loading receipts." })), error && (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-rose-300", children: error }), !loading && !receipts.length && !error && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "No receipts found for this range." })), receipts.map((receipt) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-white", children: receipt.orderRef ?? receipt.receiptNumber ?? receipt.id }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[11px] text-slate-400", children: [receipt.attendantName ?? "Attendant unknown", " \u00B7 ", formatDateTime(receipt.createdAt)] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[11px] text-slate-500", children: [receipt.customerName ?? "-", " \u00B7 ", receipt.docType ?? "Receipt"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-emerald-300", children: formatKES(receipt.total) }), receipt.id ? ((0, jsx_runtime_1.jsx)(link_1.default, { href: `/receipts/${receipt.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-xs text-emerald-300 hover:text-emerald-200", children: "View details" })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: "Unavailable" }))] })] }, receipt.id)))] })] })] }) }));
}
