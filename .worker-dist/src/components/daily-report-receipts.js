"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DailyReportReceiptsPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const formatKES = (value) => `KES ${Number(value ?? 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
})}`;
const locale = "en-KE";
const kenyaTimeZone = "Africa/Nairobi";
const formatDateTime = (value) => {
    if (!value)
        return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "-";
    return date.toLocaleString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: kenyaTimeZone,
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
function DailyReportReceiptsPanel({ start, end, q, attendantId, hideHeader, onSummary }) {
    const [receipts, setReceipts] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [lastFetchUrl, setLastFetchUrl] = (0, react_1.useState)(null);
    const [lastFetchStatus, setLastFetchStatus] = (0, react_1.useState)(null);
    const [lastFetchCount, setLastFetchCount] = (0, react_1.useState)(null);
    const [localAttendantId, setLocalAttendantId] = (0, react_1.useState)(attendantId);
    // sync localAttendantId when the prop changes
    (0, react_1.useEffect)(() => {
        setLocalAttendantId(attendantId);
    }, [attendantId]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const controller = new AbortController();
        if (!localAttendantId) {
            // no attendantId yet — abort early. Ensure parent summary is reset so
            // the summary cards reflect zero until we resolve the session.
            setReceipts([]);
            setLoading(false);
            setError(null);
            setLastFetchUrl(null);
            setLastFetchStatus(null);
            setLastFetchCount(0);
            if (onSummary)
                onSummary({ totalSales: 0, count: 0 });
            return () => controller.abort();
        }
        const fetchReceipts = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                params.set("includeItems", "false");
                params.set("size", "80");
                const startIso = toStartOfDayIso(start ?? undefined);
                const endIso = toEndOfDayIso(end ?? undefined);
                if (startIso)
                    params.set("start", startIso);
                if (endIso)
                    params.set("end", endIso);
                if (q)
                    params.set("q", q);
                const aid = localAttendantId ?? attendantId;
                if (aid)
                    params.set("attendantId", aid);
                let url = `/api/receipts?${params.toString()}`;
                // If the developer adds `?useMockReceipts=1` to the URL, use a
                // local mock endpoint to verify UI/summary behavior without needing
                // a real database or session. This is intended for QA only.
                if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("useMockReceipts") === "1") {
                    url = "/api/debug/receipts-mock";
                }
                // include credentials to ensure session cookie is sent
                const res = await fetch(url, {
                    cache: "no-store",
                    signal: controller.signal,
                    credentials: "same-origin",
                });
                // debug info to help trace why an attendant may not see receipts
                // (will appear in the browser console)
                // eslint-disable-next-line no-console
                console.debug("[DailyReportReceipts] fetch", { attendantId, url, status: res.status });
                setLastFetchUrl(url);
                setLastFetchStatus(res.status);
                const data = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(data?.error || "Failed to load receipts");
                if (!cancelled) {
                    const arr = Array.isArray(data?.receipts) ? data.receipts : [];
                    setReceipts(arr);
                    setLastFetchCount(arr.length);
                    const totalSales = arr.reduce((s, r) => s + Number(r.total ?? 0), 0);
                    if (onSummary)
                        onSummary({ totalSales, count: arr.length });
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
    }, [start, end, q, localAttendantId]);
    // If we don't have an attendantId prop, try fetching the session to determine the logged-in user id
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const controller = new AbortController();
        if (localAttendantId)
            return () => controller.abort();
        const fetchSession = async () => {
            try {
                const res = await fetch(`/api/debug/session`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
                if (!res.ok)
                    return;
                const data = await res.json().catch(() => null);
                if (!cancelled && data?.user?.id)
                    setLocalAttendantId(data.user.id);
            }
            catch (e) {
                // ignore
            }
        };
        fetchSession();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [localAttendantId]);
    const summary = (0, react_1.useMemo)(() => {
        const totalSales = receipts.reduce((sum, receipt) => sum + Number(receipt.total ?? 0), 0);
        return { totalSales, count: receipts.length };
    }, [receipts]);
    const displayDate = (() => {
        if (start && end) {
            try {
                const s = new Date(start);
                const e = new Date(end);
                if (!Number.isNaN(s.getTime()) && s.toDateString() === e.toDateString()) {
                    return s.toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: kenyaTimeZone,
                    });
                }
                return `${s.toLocaleDateString(locale, { timeZone: kenyaTimeZone })} - ${e.toLocaleDateString(locale, {
                    timeZone: kenyaTimeZone,
                })}`;
            }
            catch (e) {
                return "Selected range";
            }
        }
        if (start) {
            const s = new Date(start);
            if (!Number.isNaN(s.getTime()))
                return s.toLocaleDateString(locale, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: kenyaTimeZone,
                });
        }
        return "Selected date";
    })();
    return ((0, jsx_runtime_1.jsxs)("section", { id: "my-receipts", className: "rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-6 md:px-8", children: [!hideHeader && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-[0.3em] text-slate-400", children: "My receipts" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: displayDate }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Showing receipts captured by you for this date." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-start gap-1 text-sm sm:items-end", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[10px] uppercase tracking-[0.3em] text-slate-400", children: "Count" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xl font-semibold text-emerald-300", children: summary.count }), (0, jsx_runtime_1.jsx)("span", { className: "text-[10px] uppercase tracking-[0.3em] text-slate-400", children: "Sales" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xl font-semibold text-white", children: formatKES(summary.totalSales) })] })] }), typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugReceipts") === "1" && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 rounded-lg border border-yellow-500/40 bg-yellow-900/10 p-3 text-sm text-yellow-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-1 text-xs text-yellow-300", children: "Debug: Receipts fetch" }), (0, jsx_runtime_1.jsxs)("div", { children: ["AttendantId (prop): ", (0, jsx_runtime_1.jsx)("span", { className: "font-mono", children: String(attendantId) })] }), (0, jsx_runtime_1.jsxs)("div", { children: ["AttendantId (resolved): ", (0, jsx_runtime_1.jsx)("span", { className: "font-mono", children: String(localAttendantId ?? "-") })] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Last status: ", (0, jsx_runtime_1.jsx)("span", { className: "font-mono", children: String(lastFetchStatus ?? "-") })] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Last count: ", (0, jsx_runtime_1.jsx)("span", { className: "font-mono", children: String(lastFetchCount ?? "-") })] }), (0, jsx_runtime_1.jsxs)("div", { className: "truncate", children: ["Last URL: ", (0, jsx_runtime_1.jsx)("span", { className: "font-mono", children: String(lastFetchUrl ?? "-") })] })] }))] })), (0, jsx_runtime_1.jsxs)("div", { className: "mt-5 space-y-3", children: [loading && (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Loading receipts\u2026" }), error && (0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-rose-600/60 bg-rose-900/30 px-4 py-2 text-sm text-rose-200", children: error }), !loading && !error && receipts.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "No receipts found for this date." })), !!receipts.length && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: receipts.map((receipt) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-3xl border border-white/5 bg-slate-900/60 px-6 py-4 shadow-md", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-white", children: receipt.orderRef ?? receipt.docType ?? receipt.id }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-[12px] text-slate-400", children: [receipt.attendantName ?? "Attendant unknown", " \u00B7 ", formatDateTime(receipt.createdAt)] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-[12px] text-slate-500", children: [receipt.customerName ?? "-", " \u00B7 ", receipt.docType ?? "Receipt"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-emerald-300", children: formatKES(receipt.total) }), receipt.id ? ((0, jsx_runtime_1.jsx)("a", { href: `/receipts/print/${receipt.id}`, target: "_blank", rel: "noopener noreferrer", className: "inline-block mt-2 text-xs uppercase text-emerald-300 hover:text-emerald-200", children: "View details" })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: "Unavailable" }))] })] }, receipt.id))) }))] })] }));
}
