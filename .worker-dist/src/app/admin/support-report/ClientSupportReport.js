"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ClientSupportReport;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const DeleteSupportEntryClient_1 = __importDefault(require("./DeleteSupportEntryClient"));
const dayOptions = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const formatKES = (value) => `KES ${value.toLocaleString("en-KE")}`;
function ClientSupportReport({ periodLabel, entries, summary, initialFilters, }) {
    const router = (0, navigation_1.useRouter)();
    const [entriesState, setEntriesState] = (0, react_1.useState)(entries);
    const [selectedEntry, setSelectedEntry] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        setEntriesState(entries);
    }, [entries]);
    const totals = (0, react_1.useMemo)(() => ({
        cards: [
            { label: "Total sales", value: formatKES(summary.periodSales) },
            { label: "Receipts", value: summary.receipts.toLocaleString() },
            { label: "Items sold", value: summary.itemsSold.toLocaleString() },
            { label: "Performance bonus", value: formatKES(summary.performanceEarnings) },
            { label: "Commission", value: formatKES(summary.commission) },
            { label: "New batteries", value: summary.newBatteries.toLocaleString() },
            { label: "Changed batteries", value: summary.changedBatteries.toLocaleString() },
        ],
    }), [summary]);
    const handleSubmit = (formData) => {
        const params = new URLSearchParams();
        const from = formData.get("from") || initialFilters.from;
        const to = formData.get("to") || initialFilters.to;
        const day = formData.get("day");
        const attendantId = formData.get("attendantId");
        const search = formData.get("search");
        params.set("from", from);
        params.set("to", to);
        if (day)
            params.set("day", day);
        if (attendantId)
            params.set("attendantId", attendantId);
        if (search)
            params.set("search", search);
        router.push(`/admin/support-report?${params.toString()}`);
    };
    const handleReset = () => {
        router.push("/admin/support-report");
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-emerald-300", children: "Admin" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Support Operations Report" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Track support attendants' daily sales, performance and payouts across the trading period." })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/70", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Current window" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-slate-100", children: periodLabel })] }) }), (0, jsx_runtime_1.jsxs)("form", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4", onSubmit: (event) => {
                            event.preventDefault();
                            handleSubmit(new FormData(event.currentTarget));
                        }, children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-500", children: "From" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "date", name: "from", defaultValue: initialFilters.from, className: "bg-slate-950/60 border-slate-800" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-500", children: "To" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "date", name: "to", defaultValue: initialFilters.to, className: "bg-slate-950/60 border-slate-800" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-500", children: "Day of week" }), (0, jsx_runtime_1.jsx)("select", { name: "day", defaultValue: initialFilters.day, className: "rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100", children: dayOptions.map((day) => ((0, jsx_runtime_1.jsx)("option", { value: day, children: day || "Any day" }, day || "ALL"))) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-500", children: "Attendant ID" }), (0, jsx_runtime_1.jsx)(Input_1.default, { name: "attendantId", placeholder: "User ID", defaultValue: initialFilters.attendantId, className: "bg-slate-950/60 border-slate-800" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex flex-col gap-2 text-sm text-slate-300 md:col-span-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-wide text-slate-500", children: "Search (name or email)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { name: "search", placeholder: "e.g. justus@betech.co.ke", defaultValue: initialFilters.search, className: "bg-slate-950/60 border-slate-800" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3 md:col-span-2 lg:col-span-4", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { type: "submit", variant: "primary", className: "bg-emerald-500 px-5 text-black hover:brightness-95", children: "Apply filters" }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", onClick: handleReset, children: "Reset" })] })] })] }), (0, jsx_runtime_1.jsx)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/70", children: (0, jsx_runtime_1.jsx)("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: totals.cards.map((card) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: card.label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xl font-semibold text-emerald-300", children: card.value })] }, card.label))) }) }), (0, jsx_runtime_1.jsx)(Card_1.default, { className: "border-slate-800 bg-slate-900/70", children: (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsx)("tr", { children: ["Date", "Day", "Attendant", "Sales (KES)", "Items", "New batteries", "Changed", "Performance", "Commission", "Actions"].map((heading) => ((0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: heading }, heading))) }) }), (0, jsx_runtime_1.jsx)("tbody", { children: entriesState.length === 0 ? ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 10, className: "px-3 py-6 text-center text-slate-500", children: "No support submissions match your filters." }) })) : (entriesState.map((entry, idx) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-slate-800", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: entry.date }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-300", children: entry.dayOfWeek }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col text-slate-100", children: [(0, jsx_runtime_1.jsx)("span", { children: entry.attendantName }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] text-slate-500", children: entry.attendantEmail ?? "-" })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right font-semibold text-emerald-300", children: formatKES(entry.totalSales) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right text-slate-100", children: entry.itemsSold.toLocaleString() }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-center text-slate-100", children: entry.newBatteries }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-center text-slate-100", children: entry.changedBatteries }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right text-slate-100", children: formatKES(entry.performanceEarnings) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right text-slate-100", children: formatKES(entry.commission) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2 items-center", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300", disabled: true, children: "View" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300", disabled: true, children: "Export" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300", disabled: true, children: "Edit" }), (0, jsx_runtime_1.jsx)(DeleteSupportEntryClient_1.default, { entryId: entry.id, entry: entry, onDeleted: (id) => {
                                                            // optimistic removal: remove from local state immediately
                                                            setEntriesState((prev) => prev.filter((e) => e.id !== id));
                                                            // clear selected detail view if it was the deleted entry
                                                            if (selectedEntry?.id === id)
                                                                setSelectedEntry(null);
                                                        }, onRestore: (entryObj) => {
                                                            // rollback: insert at original index
                                                            setEntriesState((prev) => {
                                                                const copy = prev.slice();
                                                                copy.splice(idx, 0, entryObj);
                                                                return copy;
                                                            });
                                                        } })] }) })] }, entry.id)))) })] }) }) })] }));
}
