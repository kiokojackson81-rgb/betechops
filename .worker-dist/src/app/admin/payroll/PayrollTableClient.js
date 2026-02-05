"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PayrollTableClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const getLandingPage_1 = require("@/lib/getLandingPage");
const categoryOrder = [
    "DIRECT_SALES_OPS",
    "MARKETING_OPS",
    "JUMIA_KILIMALL_OPS",
    "SUPPORT_OPS",
    "BETECH_OPS",
];
const formatCurrency = (value) => `KES ${value.toLocaleString("en-US")}`;
const getDisplayName = (row) => {
    if (!row)
        return "—";
    return row.name ?? row.email ?? "Unassigned";
};
function PerformanceTile({ label, value, meta }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/5 bg-slate-950/30 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-lg font-semibold text-slate-100", children: value }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-500", children: meta })] }));
}
function PayrollTableClient({ rows, periodLabel, }) {
    const [categoryFilter, setCategoryFilter] = (0, react_1.useState)("ALL");
    const [statusFilter, setStatusFilter] = (0, react_1.useState)("ALL");
    const [search, setSearch] = (0, react_1.useState)("");
    const availableCategories = (0, react_1.useMemo)(() => {
        const seen = new Set(rows
            .map((row) => row.attendantCategory)
            .filter((value) => Boolean(value)));
        return categoryOrder.filter((value) => seen.has(value)).concat(Array.from(seen).filter((value) => !categoryOrder.includes(value)));
    }, [rows]);
    const filteredRows = (0, react_1.useMemo)(() => {
        return rows.filter((row) => {
            if (categoryFilter !== "ALL" && row.attendantCategory !== categoryFilter)
                return false;
            if (statusFilter === "ACTIVE" && !row.isActive)
                return false;
            if (statusFilter === "INACTIVE" && row.isActive)
                return false;
            if (search) {
                const term = search.toLowerCase();
                const haystack = `${row.name ?? ""} ${row.email ?? ""}`.toLowerCase();
                if (!haystack.includes(term))
                    return false;
            }
            return true;
        });
    }, [categoryFilter, rows, search, statusFilter]);
    const totals = (0, react_1.useMemo)(() => {
        return filteredRows.reduce((acc, row) => {
            acc.baseTransport += row.baseSalary + row.transportAllowance;
            acc.commission += row.commission;
            acc.bonus += row.bonusTotal;
            acc.deductions += row.deductionTotal;
            acc.net += row.netPay;
            return acc;
        }, { baseTransport: 0, commission: 0, bonus: 0, deductions: 0, net: 0 });
    }, [filteredRows]);
    const performanceSummary = (0, react_1.useMemo)(() => {
        if (!filteredRows.length)
            return null;
        const getProductActivity = (row) => row.newProducts + row.editedProducts + row.copiedProducts;
        const bestBy = (selector) => filteredRows.reduce((best, current) => (selector(current) > selector(best) ? current : best), filteredRows[0]);
        const bestSales = bestBy((row) => row.totalSales);
        const bestProfit = bestBy((row) => row.totalProfit);
        const bestReceipts = bestBy((row) => row.totalReceipts);
        const bestItems = bestBy((row) => row.totalItems);
        const bestProductWork = bestBy(getProductActivity);
        return {
            bestSales,
            bestProfit,
            bestReceipts,
            bestItems,
            bestProductWork,
            productWorkCount: getProductActivity(bestProductWork),
        };
    }, [filteredRows]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Current period" }), (0, jsx_runtime_1.jsxs)("h1", { className: "text-2xl font-semibold", children: ["Payroll \u00B7 ", periodLabel] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500 mt-1", children: "Marketing Ops rows have a darker treatment and Brendah is pinned to the rose border for quick reference." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2 text-xs", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-slate-200", children: "Marketing Ops highlight" }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-rose-200", children: "Brendah focus" }), (0, jsx_runtime_1.jsx)("a", { href: "#performances", className: "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100", children: "Performances" })] })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "divide-y divide-white/5 bg-slate-900/60 border-slate-800", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-3 lg:grid-cols-5", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Category" }), (0, jsx_runtime_1.jsxs)("select", { value: categoryFilter, onChange: (event) => setCategoryFilter(event.target.value), className: "w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "All categories" }), availableCategories.map((category) => ((0, jsx_runtime_1.jsx)("option", { value: category, children: (0, getLandingPage_1.getCategoryLabel)(category) }, category)))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Status" }), (0, jsx_runtime_1.jsxs)("select", { value: statusFilter, onChange: (event) => setStatusFilter(event.target.value), className: "w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "All" }), (0, jsx_runtime_1.jsx)("option", { value: "ACTIVE", children: "Active" }), (0, jsx_runtime_1.jsx)("option", { value: "INACTIVE", children: "Inactive" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "md:col-span-2 lg:col-span-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Search" }), (0, jsx_runtime_1.jsx)(Input_1.default, { placeholder: "Name or email", value: search, onChange: (event) => setSearch(event.target.value), className: "bg-slate-950/60 border-slate-800 text-sm text-slate-100" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2 lg:grid-cols-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/5 bg-slate-950/30 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: "Base + allowance" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold", children: formatCurrency(totals.baseTransport) }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-500", children: "Includes transport allowance" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/5 bg-slate-950/30 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: "Commission" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold", children: formatCurrency(totals.commission) }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-500", children: "Net only" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/5 bg-slate-950/30 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: "Bonuses" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold", children: formatCurrency(totals.bonus) }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-500", children: "Includes commission top-ups" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/5 bg-slate-950/30 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase text-slate-400", children: "Net pay" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold", children: formatCurrency(totals.net) }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-500", children: "After deductions" })] })] })] }), performanceSummary && ((0, jsx_runtime_1.jsx)("div", { id: "performances", children: (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "bg-slate-900/70 border border-slate-800", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-[0.3em] text-slate-400", children: "Performances" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-slate-100", children: "AI-curated performance menu" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Compares receipts, direct sales, Kilimall uploads/edits, and product actions to spotlight who is driving value." })] }), (0, jsx_runtime_1.jsx)("span", { className: "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200 uppercase tracking-wide", children: "Compare" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5", children: [(0, jsx_runtime_1.jsx)(PerformanceTile, { label: "Top sales", value: formatCurrency(performanceSummary.bestSales.totalSales), meta: getDisplayName(performanceSummary.bestSales) }), (0, jsx_runtime_1.jsx)(PerformanceTile, { label: "Highest profit", value: formatCurrency(performanceSummary.bestProfit.totalProfit), meta: getDisplayName(performanceSummary.bestProfit) }), (0, jsx_runtime_1.jsx)(PerformanceTile, { label: "Most receipts", value: performanceSummary.bestReceipts.totalReceipts.toLocaleString("en-US"), meta: getDisplayName(performanceSummary.bestReceipts) }), (0, jsx_runtime_1.jsx)(PerformanceTile, { label: "Items sold", value: performanceSummary.bestItems.totalItems.toLocaleString("en-US"), meta: getDisplayName(performanceSummary.bestItems) }), (0, jsx_runtime_1.jsx)(PerformanceTile, { label: "Product uploads/edits", value: performanceSummary.productWorkCount.toLocaleString("en-US"), meta: `${getDisplayName(performanceSummary.bestProductWork)} · new/edited/copied` })] })] }) })), (0, jsx_runtime_1.jsx)(Card_1.default, { className: "bg-slate-900/60 border-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-slate-900/80 border-b border-white/10 text-xs uppercase text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Attendant" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left", children: "Category" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Sales" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Base + Allowance" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Commission" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Bonuses" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Deductions" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Net pay" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right", children: "Actions" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [filteredRows.map((row) => {
                                        const isMarketing = row.attendantCategory === "MARKETING_OPS";
                                        const isBrendah = (row.name ?? "").toLowerCase().includes("brendah") ||
                                            (row.email ?? "").toLowerCase().includes("brendah");
                                        const deductionParts = [
                                            ["Chama", row.adjustmentBreakdown.chama],
                                            ["Lateness", row.adjustmentBreakdown.lateness],
                                            ["Discipline", row.adjustmentBreakdown.discipline],
                                            ["Other", row.adjustmentBreakdown.other],
                                            ["Penalties", row.adjustmentBreakdown.penalties],
                                        ].filter(([, amount]) => {
                                            const n = Number(amount);
                                            return !Number.isNaN(n) && n > 0;
                                        });
                                        const additionEntries = row.adjustmentEntries.filter((entry) => entry.kind === "ADDITION");
                                        const deductionEntries = row.adjustmentEntries.filter((entry) => entry.kind === "DEDUCTION");
                                        const profitText = row.totalProfit !== 0
                                            ? row.totalProfit.toLocaleString("en-US")
                                            : row.totalSales > 0 && row.totalReceipts > 0
                                                ? "— (no profit data)"
                                                : "0";
                                        const profitTitle = row.totalProfit === 0 && row.totalSales > 0 && row.totalReceipts > 0
                                            ? "No per-receipt profit snapshots (check pricing)"
                                            : "";
                                        return ((0, jsx_runtime_1.jsxs)("tr", { className: `border-t border-white/5 ${isMarketing ? "bg-slate-900/60" : ""} ${isBrendah ? "border-rose-500/40" : ""}`, children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-slate-100", children: (0, jsx_runtime_1.jsx)(link_1.default, { className: "underline-offset-2 hover:underline", href: `/admin/attendants/${row.attendantId}/payroll`, children: row.name ?? row.email ?? "No name" }) }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-500", children: row.email ?? "No email" }), isBrendah && (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-rose-300", children: "Brendah (focus)" })] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: (0, getLandingPage_1.getCategoryLabel)(row.attendantCategory) }), isMarketing && ((0, jsx_runtime_1.jsx)("span", { className: "ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-100", children: "Marketing Ops" }))] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 text-right space-y-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-slate-100", children: row.totalSales.toLocaleString("en-US") }), (0, jsx_runtime_1.jsxs)("div", { className: "text-[11px] text-slate-500", title: profitTitle, children: ["Profit", ' ', row.totalProfit === 0 && row.totalSales > 0 && row.totalReceipts > 0 ? ((0, jsx_runtime_1.jsx)("a", { className: "underline text-slate-300", href: `/admin/receipts/missing-buying?attendantId=${row.attendantId}`, children: profitText })) : (profitText)] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-[11px] text-slate-500", children: [row.totalReceipts.toLocaleString("en-US"), " receipts \u00B7 ", row.totalItems.toLocaleString("en-US"), " items"] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 text-right", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-slate-100", children: formatCurrency(row.baseSalary) }), (0, jsx_runtime_1.jsxs)("div", { className: "text-[11px] text-slate-500", children: ["Transport ", formatCurrency(row.transportAllowance)] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 text-right", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-emerald-300", children: formatCurrency(row.commission) }), (0, jsx_runtime_1.jsxs)("div", { className: "text-[11px] text-slate-500", children: ["Gross ", formatCurrency(row.commissionGross)] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 text-right", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-slate-100", children: formatCurrency(row.bonusTotal) }), (0, jsx_runtime_1.jsxs)("div", { className: "text-[11px] text-slate-500", children: ["Bonus ", row.adjustmentBreakdown.bonus.toLocaleString("en-US"), " \u00B7 Top-ups ", row.adjustmentBreakdown.commissionTopUp.toLocaleString("en-US")] }), additionEntries.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "text-[11px] text-slate-400", children: additionEntries.map((entry) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { children: entry.label || entry.adjustmentType }), (0, jsx_runtime_1.jsx)("span", { children: formatCurrency(entry.amount) })] }, entry.id))) }))] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 text-right", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-slate-100", children: formatCurrency(row.deductionTotal) }), deductionParts.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "text-[11px] text-slate-500", children: deductionParts.map(([label, amount], index) => ((0, jsx_runtime_1.jsxs)("span", { children: [label, " ", Number(amount).toLocaleString("en-US"), index < deductionParts.length - 1 && " · "] }, label))) })), deductionEntries.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "text-[11px] text-slate-400", children: deductionEntries.map((entry) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { children: entry.label || entry.adjustmentType }), (0, jsx_runtime_1.jsx)("span", { children: formatCurrency(entry.amount) })] }, entry.id))) }))] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsx)("div", { className: "text-lg font-semibold text-emerald-300", children: formatCurrency(row.netPay) }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsx)(link_1.default, { className: "text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800", href: `/admin/attendants/${row.attendantId}/payroll`, children: "View" }) })] }, row.attendantId));
                                    }), filteredRows.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 9, className: "px-4 py-6 text-center text-slate-500", children: "No attendants match the selected filters." }) }))] })] }) }) })] }));
}
