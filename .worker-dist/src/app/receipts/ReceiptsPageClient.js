"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptsPageClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const ReceiptFormClient_1 = __importDefault(require("./ReceiptFormClient"));
function ReceiptsPageClient({ initial }) {
    const [view, setView] = (0, react_1.useState)("create");
    const [query, setQuery] = (0, react_1.useState)("");
    const [results, setResults] = (0, react_1.useState)(initial ?? []);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [totals, setTotals] = (0, react_1.useState)({
        count: 0,
        amount: 0,
        items: 0,
    });
    const [page, setPage] = (0, react_1.useState)(1);
    const size = 10;
    const [attendantId, setAttendantId] = (0, react_1.useState)(null);
    const [fromDate, setFromDate] = (0, react_1.useState)(null);
    const [toDate, setToDate] = (0, react_1.useState)(null);
    const listRef = (0, react_1.useRef)(null);
    const formRef = (0, react_1.useRef)(null);
    const scrollIntoView = (ref) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };
    const handleCreated = () => {
        setView("create");
        setTimeout(() => scrollIntoView(formRef), 100);
    };
    const doSearch = async (opts) => {
        setLoading(true);
        try {
            const nextPage = opts?.page ?? page;
            const params = new URLSearchParams();
            if (query.trim())
                params.set("q", query.trim());
            if (fromDate)
                params.set("from", fromDate);
            if (toDate)
                params.set("to", toDate);
            params.set("includeItems", "true");
            params.set("page", String(nextPage));
            params.set("size", String(size));
            if (attendantId)
                params.set("attendantId", attendantId);
            const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
            const data = await res.json();
            setResults(data.receipts || []);
            // Try to read totals from API; otherwise compute locally
            if (data.totals) {
                setTotals({ count: data.totals.count || 0, amount: data.totals.amount || 0, items: data.totals.items || 0 });
            }
            else {
                const computedCount = (data.receipts || []).length;
                const computedAmount = (data.receipts || []).reduce((s, r) => s + (r.total || 0), 0);
                const computedItems = (data.receipts || []).reduce((s, r) => s + ((r.items && r.items.length) || 0), 0);
                setTotals({ count: computedCount, amount: computedAmount, items: computedItems });
            }
            setPage(data.paging?.page ?? nextPage);
        }
        catch {
            setResults([]);
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        if (view !== "list")
            return;
        const t = setTimeout(() => doSearch({ page: 1 }), 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, view]);
    // On mount, detect attendantId in the URL and open list view filtered to that attendant
    (0, react_1.useEffect)(() => {
        try {
            if (typeof window !== "undefined") {
                const sp = new URLSearchParams(window.location.search);
                const aid = sp.get("attendantId");
                if (aid) {
                    setAttendantId(aid);
                    setView("list");
                    // If server-side provided initial receipts, prefer them; otherwise trigger search
                    if (!initial || initial.length === 0) {
                        void doSearch({ page: 1 });
                    }
                    else {
                        setResults(initial || []);
                    }
                }
            }
        }
        catch (e) {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const openListView = () => {
        setView("list");
        setTimeout(() => scrollIntoView(listRef), 100);
        void doSearch({ page: 1 });
    };
    const openCreateView = () => {
        setView("create");
        setTimeout(() => scrollIntoView(formRef), 100);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "page-shell space-y-6 py-6", children: [view === "create" && ((0, jsx_runtime_1.jsxs)("section", { ref: formRef, className: "rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Receipts desk" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold text-white", children: "Betech Customers Operations" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Track every printable document, search by customer, and open the PDF drawer without leaving this page." })] }), (0, jsx_runtime_1.jsx)("button", { onClick: openListView, className: "rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95", children: "View receipts" })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4", children: (0, jsx_runtime_1.jsx)(ReceiptFormClient_1.default, { onCreated: handleCreated, showHero: false }) })] })), view === "list" && ((0, jsx_runtime_1.jsxs)("section", { ref: listRef, className: "rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-black/30", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: attendantId ? "Receipts list" : "Receipts desk" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-white", children: attendantId ? "Read-only receipts history" : "Search receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: attendantId
                                            ? "Explore every receipt captured across the system and filter by date, range, or attendant."
                                            : "Search by receipt number, customer phone, or attendant name." })] }), (0, jsx_runtime_1.jsx)("button", { onClick: openCreateView, className: "rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10", children: "Create receipt" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid grid-cols-1 gap-3 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "col-span-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: [
                                                    { key: "today", label: "Today" },
                                                    { key: "yesterday", label: "Yesterday" },
                                                    { key: "week", label: "Week" },
                                                    { key: "month", label: "Month" },
                                                    { key: "custom", label: "Custom" },
                                                ].map((p) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                        const now = new Date();
                                                        let f = null;
                                                        let t = null;
                                                        if (p.key === "today") {
                                                            f = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                                            t = new Date(f);
                                                        }
                                                        else if (p.key === "yesterday") {
                                                            const y = new Date(now);
                                                            y.setDate(y.getDate() - 1);
                                                            f = new Date(y.getFullYear(), y.getMonth(), y.getDate());
                                                            t = new Date(f);
                                                        }
                                                        else if (p.key === "week") {
                                                            const start = new Date(now);
                                                            start.setDate(start.getDate() - 6);
                                                            f = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                                                            t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                                        }
                                                        else if (p.key === "month") {
                                                            const start = new Date(now.getFullYear(), now.getMonth(), 1);
                                                            f = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                                                            t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                                        }
                                                        else {
                                                            // custom: keep existing and focus inputs
                                                            setFromDate(fromDate);
                                                            setToDate(toDate);
                                                            return;
                                                        }
                                                        const fmt = (d) => d.toISOString().slice(0, 10);
                                                        setFromDate(f ? fmt(f) : null);
                                                        setToDate(t ? fmt(t) : null);
                                                        void doSearch({ page: 1 });
                                                    }, className: "rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700", children: p.label }, p.key))) }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Receipt number, customer phone or attendant", value: query, onChange: (e) => setQuery(e.target.value), className: "ml-2 flex-1 rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "From" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: fromDate ?? "", onChange: (e) => setFromDate(e.target.value || null), className: "rounded bg-slate-900 p-1 text-sm text-white" }), (0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "To" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: toDate ?? "", onChange: (e) => setToDate(e.target.value || null), className: "rounded bg-slate-900 p-1 text-sm text-white" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => doSearch({ page: 1 }), className: "ml-2 rounded-full bg-emerald-500 px-3 py-1 text-sm font-semibold text-black", children: "Apply" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                    setFromDate(null);
                                                    setToDate(null);
                                                    void doSearch({ page: 1 });
                                                }, className: "ml-2 rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200", children: "Reset" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => doSearch(), className: "flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black", children: loading ? "Searching..." : "Search" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                            setResults([]);
                                            setQuery("");
                                        }, className: "rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200", children: "Clear" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 space-y-2", children: results.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "No receipts found. Try a different query." })) : (results.map((r) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-md bg-slate-950/40 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-semibold", children: r.orderRef || r.id }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [r.customerName || "-", " - ", r.customerPhone || "-"] })] }), r.detailUrl ? ((0, jsx_runtime_1.jsx)(link_1.default, { href: r.detailUrl, target: "_blank", rel: "noopener noreferrer", className: "rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black", children: "View receipt" })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: "Receipt preview unavailable" }))] }, r.id)))) }), results.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-400", children: ["Showing ", results.length, " results"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { disabled: page <= 1, onClick: () => {
                                            const next = Math.max(1, page - 1);
                                            setPage(next);
                                            doSearch({ page: next });
                                        }, className: "rounded border border-white/10 px-3 py-1 text-sm text-slate-200 disabled:opacity-40", children: "Prev" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-200", children: ["Page ", page] }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                            const next = page + 1;
                                            setPage(next);
                                            doSearch({ page: next });
                                        }, className: "rounded border border-white/10 px-3 py-1 text-sm text-slate-200", children: "Next" })] })] }))] }))] }));
}
