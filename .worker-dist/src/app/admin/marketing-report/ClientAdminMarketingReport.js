"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ClientAdminMarketingReport;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
// server enforces ADMIN access for this page; client-side session checks can be flaky,
// so show admin actions when this component is rendered on the admin page.
const ProgressBar_1 = __importDefault(require("@/app/_components/ProgressBar"));
const FilterBar_1 = __importDefault(require("./FilterBar"));
const MultiDayExportClient_1 = __importDefault(require("./MultiDayExportClient"));
const DeleteEntryClient_1 = __importDefault(require("./DeleteEntryClient"));
const AdminPricingPanel_1 = __importDefault(require("./AdminPricingPanel"));
const cardClasses = "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";
const dayLabels = ["All days", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const formatKES = (value) => `KES ${Math.round(value).toLocaleString("en-KE")}`;
const getSaleItemsCount = (sale) => {
    if (!sale)
        return 0;
    const countRaw = sale.itemsCount;
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw ?? 0);
    return Number.isFinite(count) && count > 0 ? count : 1;
};
const getSaleSellingPrice = (sale) => {
    if (!sale)
        return 0;
    const raw = sale.sellingPrice;
    if (typeof raw === "number")
        return raw;
    const asNumber = Number(raw ?? 0);
    return Number.isFinite(asNumber) ? asNumber : 0;
};
function ClientAdminMarketingReport({ entries = [], aggregates = undefined, selectedPeriodKey = "", dow = "", dateStr = "", userFilter = "", }) {
    const [selectedEntry, setSelectedEntry] = (0, react_1.useState)(null);
    const summary = aggregates ?? {
        totalSales: 0,
        totalProfit: 0,
        totalItems: 0,
        paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0 },
        commission: { commission: 0, nextTarget: 1000000, tiersReached: [], nextTierReward: 0 },
    };
    const baseParams = (0, react_1.useMemo)(() => {
        const params = new URLSearchParams();
        if (selectedPeriodKey)
            params.set("period", selectedPeriodKey);
        if (dateStr)
            params.set("date", dateStr);
        if (userFilter)
            params.set("user", userFilter);
        return params;
    }, [selectedPeriodKey, dateStr, userFilter]);
    const getDayHref = (dayLabel) => {
        const params = new URLSearchParams(baseParams);
        if (dayLabel === "All days") {
            params.delete("dow");
        }
        else {
            params.set("dow", dayLabel);
        }
        const qs = params.toString();
        return `/admin/marketing-report${qs ? `?${qs}` : ""}`;
    };
    const isActiveDay = (dayLabel) => (dayLabel === "All days" ? !dow : dow === dayLabel);
    // Maintain a local copy of entries for optimistic updates. Resync whenever the
    // server sends new results (i.e., when filters change or a revalidation occurs).
    const [entriesState, setEntriesState] = (0, react_1.useState)(entries);
    (0, react_1.useEffect)(() => {
        setEntriesState(entries);
    }, [entries]);
    const entriesList = entriesState;
    const hasEntries = entriesList.length > 0;
    const modalItemCount = selectedEntry
        ? (selectedEntry.receipts?.reduce((sum, rec) => sum + (rec.items?.length || 0), 0) ?? 0) ||
            (selectedEntry.sales?.reduce((sum, sale) => sum + getSaleItemsCount(sale), 0) ?? 0)
        : 0;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto flex max-w-6xl flex-col gap-6 p-6 text-slate-100", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Marketing report" }), (0, jsx_runtime_1.jsx)("p", { className: "text-slate-300", children: "Admin view of the Marketing Performance Tracker with daily logs, channel completeness, and live session health." })] }), (0, jsx_runtime_1.jsxs)("section", { className: `${cardClasses} p-4 space-y-4`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-[1fr_auto] items-start", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Trading period" }), (0, jsx_runtime_1.jsx)("div", { className: "text-lg font-semibold", children: aggregates?.period?.label ?? selectedPeriodKey ?? "-" })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2", children: (0, jsx_runtime_1.jsx)(MultiDayExportClient_1.default, { periodKey: selectedPeriodKey, userFilter: userFilter }) })] }), (0, jsx_runtime_1.jsx)(FilterBar_1.default, { initialPeriod: selectedPeriodKey, initialDay: dow, initialDate: dateStr, initialUser: userFilter }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: dayLabels.map((label) => ((0, jsx_runtime_1.jsx)(link_1.default, { href: getDayHref(label), className: `rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${isActiveDay(label)
                                ? "bg-emerald-500 text-black border-emerald-500"
                                : "border-slate-700 text-slate-300 hover:border-white/40"}`, children: label }, label))) }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: selectedPeriodKey ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("a", { className: "rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500", href: `/api/admin/marketing-report/export-period?period=${encodeURIComponent(selectedPeriodKey)}${dow ? `&dow=${encodeURIComponent(dow)}` : ""}${userFilter ? `&user=${encodeURIComponent(userFilter)}` : ""}`, target: "_blank", rel: "noopener noreferrer", children: "Export period CSV" }), (0, jsx_runtime_1.jsx)("a", { className: "rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500", href: `/api/admin/marketing-report/export-period-pdf?tradingPeriodKey=${encodeURIComponent(selectedPeriodKey)}${userFilter ? `&user=${encodeURIComponent(userFilter)}` : ""}`, target: "_blank", rel: "noopener noreferrer", children: "Export period PDF" })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-400", children: "Select a trading period to enable exports" })) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-5 text-sm mt-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Period sales" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: formatKES(summary.totalSales ?? 0) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Period profit" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: formatKES(summary.totalProfit ?? 0) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Items sold" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: (summary.totalItems ?? 0).toLocaleString() })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "MPESA vs Cash" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-slate-200", children: ["MPESA ", formatKES(summary.paymentStats?.totalSalesMpesa ?? 0), (0, jsx_runtime_1.jsx)("br", {}), "Cash ", formatKES(summary.paymentStats?.totalSalesCash ?? 0)] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Commission (cumulative)" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: formatKES(summary.commission?.commission ?? 0) }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-emerald-300", children: (summary.commission?.tiersReached?.length ?? 0) ? `Tiers: ${summary.commission.tiersReached.join(", ")}` : "No tiers reached yet" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 mt-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-xs text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { children: "Progress toward next tier" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-emerald-300", children: ["Next reward: KES ", summary.commission?.nextTierReward?.toLocaleString?.() ?? 0] })] }), (0, jsx_runtime_1.jsx)(ProgressBar_1.default, { value: summary.commission?.commission ?? 0, max: summary.commission?.nextTarget ?? 1000000 })] })] }), (0, jsx_runtime_1.jsx)(AdminPricingPanel_1.default, {}), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20 space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Daily breakdown" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "One row per day, blending marketing and attendant uploads." })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-xl border border-slate-800", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-slate-950/80 text-left text-xs uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsx)("tr", { children: ["Date", "Day", "Channel", "Total sales", "Total profit", "Receipts / items", "TikTok", "IG / FB / YT", "WhatsApp", "Live summary", "Stock enough?", "Shop ready?", "Weekly comment", "Actions"].map((col) => ((0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: col }, col))) }) }), (0, jsx_runtime_1.jsx)("tbody", { children: !hasEntries ? ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-6 text-center text-slate-400", colSpan: 14, children: "No entries for this range yet." }) })) : (entriesList.map((entry, idx) => {
                                        const dateStr = entry.date?.split?.("T")[0] ?? entry.date ?? "—";
                                        const rowClass = idx % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40";
                                        const tikTokDone = entry.tiktokPosted2Videos || entry.tiktokPosted4ExplanatoryVideos || entry.shot4ProductVideos;
                                        const igDone = entry.igFbYtPosted2VideosEach;
                                        const igReplied = entry.igFbYtRepliedAll;
                                        const waDone = entry.waPostedStatus || entry.waPosted10Statuses;
                                        const waReplied = entry.waRespondedAll;
                                        const liveSummary = `${entry.liveSessionsCount ?? (entry.liveSessionsEstimatedViewers || entry.liveViewers ? 1 : 0)} sessions / ${entry.liveSessionsEstimatedViewers ?? entry.liveViewers ?? 0} viewers`;
                                        const stockOk = Boolean(entry.stockEnoughFastMovers);
                                        const shopReady = Boolean(entry.shopCleaned && entry.shopWellArranged && entry.displayWellLabeled);
                                        const receiptsItems = entry.receipts?.reduce((sum, rec) => sum + (rec.items?.length || 0), 0) ?? 0;
                                        const salesCount = entry.sales?.reduce((sum, sale) => sum + getSaleItemsCount(sale), 0) ?? 0;
                                        const itemCount = receiptsItems || salesCount;
                                        const receiptsCount = entry.receipts?.length ?? (entry.sales?.length ?? 0);
                                        const channelLabel = entry.source === "ATTENDANT" ? "Attendant" : "Marketing";
                                        const channelClass = entry.source === "ATTENDANT"
                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                            : "bg-slate-800 text-white/80 border border-slate-700";
                                        return ((0, jsx_runtime_1.jsxs)("tr", { className: `border-t border-slate-800 ${rowClass}`, children: [(0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: dateStr }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: entry.dayOfWeek ?? "—" }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: (0, jsx_runtime_1.jsx)("span", { className: `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${channelClass}`, children: channelLabel }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right font-semibold text-white", children: formatKES(entry.totalSales) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right text-slate-100", children: formatKES(entry.totalProfit) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-2 text-right text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "font-semibold text-white", children: [receiptsCount, " receipts"] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [itemCount, " items"] })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("span", { title: "Posted", children: tikTokDone ? "Y" : "N" }), (0, jsx_runtime_1.jsx)("span", { title: "Replied", children: entry.tiktokRepliedAll ? "Y" : "N" })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("span", { title: "Posted", children: igDone ? "Y" : "N" }), (0, jsx_runtime_1.jsx)("span", { title: "Replied", children: igReplied ? "Y" : "N" })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("span", { title: "Status/contacts", children: waDone ? "Y" : "N" }), (0, jsx_runtime_1.jsx)("span", { title: "Replied all", children: waReplied ? "Y" : "N" })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: liveSummary }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-center", children: stockOk ? "Y" : "N" }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-center", children: shopReady ? "Y" : "N" }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-2 text-slate-300", title: entry.weeklyComment || "", children: [(entry.weeklyComment || "").slice(0, 40), (entry.weeklyComment || "").length > 40 ? "…" : ""] }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-300", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSelectedEntry(entry), className: "text-xs text-sky-300 hover:text-sky-200 underline text-left", children: "View Day \u2192 Sales Details" }), (0, jsx_runtime_1.jsx)("a", { href: `/api/admin/marketing-report/export-day?entryId=${entry.id}`, target: "_blank", rel: "noreferrer", className: "text-xs text-emerald-300 underline hover:text-emerald-200", children: "Export day CSV" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 items-center", children: [(0, jsx_runtime_1.jsx)("a", { href: `/admin/marketing-report/${entry.id}/edit`, target: "_blank", rel: "noopener noreferrer", className: "text-xs text-white/80 underline hover:text-white", "aria-label": `Edit entry ${entry.id}`, children: "Edit entry" }), (0, jsx_runtime_1.jsx)(DeleteEntryClient_1.default, { entryId: entry.id, entry: entry, onDeleted: (id) => {
                                                                            setEntriesState((prev) => prev.filter((e) => e.id !== id));
                                                                            if (selectedEntry?.id === id)
                                                                                setSelectedEntry(null);
                                                                        }, onRestore: (entryObj) => {
                                                                            setEntriesState((prev) => {
                                                                                const copy = prev.slice();
                                                                                copy.splice(idx, 0, entryObj);
                                                                                return copy;
                                                                            });
                                                                        } })] })] }) })] }, entry.id));
                                    })) })] }) })] }), selectedEntry && ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-black/70", onClick: () => setSelectedEntry(null) }), (0, jsx_runtime_1.jsxs)("div", { className: "relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-black/60", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Sales details" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl font-semibold text-white", children: selectedEntry.date.split?.("T")[0] ?? selectedEntry.date }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: [selectedEntry.dayOfWeek ?? "—", " \u2022 ", selectedEntry.source === "ATTENDANT" ? "Attendant" : "Marketing", " entry", selectedEntry.submittedByName ? ` • ${selectedEntry.submittedByName}` : ""] })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "text-sm text-slate-400 hover:text-white", onClick: () => setSelectedEntry(null), "aria-label": "Close sales details", children: "Close" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-4 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Total sales" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-white", children: formatKES(selectedEntry.totalSales) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Total profit" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-white", children: formatKES(selectedEntry.totalProfit) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Items recorded" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-white", children: modalItemCount ?? 0 })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 space-y-4", children: [selectedEntry.receipts && selectedEntry.receipts.length > 0 ? (selectedEntry.receipts.map((receipt, idx) => {
                                        const receiptItems = receipt.items ?? [];
                                        const fallbackTotal = receiptItems.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
                                        const receiptBuyingTotal = Math.max(0, Number(receipt.buyingTotal ?? fallbackTotal));
                                        const hasBuyingTotal = receiptBuyingTotal > 0;
                                        return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("p", { className: "text-sm font-semibold text-white", children: ["Receipt ", receipt.receiptNumber || `#${idx + 1}`] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: receipt.paymentMethod ?? "-" })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-semibold text-white", children: formatKES(Number(receipt.sellingTotal ?? 0)) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-2", children: [receiptItems.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "No items recorded for this receipt." })) : (receiptItems.map((item, itemIdx) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm text-white/80", children: [(0, jsx_runtime_1.jsx)("span", { children: item.productName || "(unnamed item)" }), (0, jsx_runtime_1.jsx)("span", { children: formatKES(Number(item.buyingPrice ?? 0)) })] }, itemIdx)))), hasBuyingTotal ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["Buying total: ", formatKES(receiptBuyingTotal)] })) : null] })] }, receipt.id ?? `receipt-${idx}`));
                                    })) : ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400", children: "No receipt data available for this entry." })), selectedEntry.sales && selectedEntry.sales.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Sales rows" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 space-y-2", children: selectedEntry.sales.map((sale, idx) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between text-sm text-white/80", children: [(0, jsx_runtime_1.jsx)("span", { children: sale.product || "-" }), (0, jsx_runtime_1.jsx)("span", { children: formatKES(getSaleSellingPrice(sale)) })] }, idx))) })] }))] })] })] }))] }));
}
