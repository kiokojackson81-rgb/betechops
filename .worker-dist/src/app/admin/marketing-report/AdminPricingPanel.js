"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminPricingPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const toast_1 = require("@/lib/ui/toast");
const unpricedReceiptGrouping_1 = require("@/lib/unpricedReceiptGrouping");
const POLL_INTERVAL_MS = 60000;
const sourceLabels = {
    "daily-sale": "Daily report",
    support: "Support entry",
};
const formatKES = (value) => `KES ${Math.round(value).toLocaleString("en-KE")}`;
const getSaleKey = (sale) => `${sale.source}:${sale.id}`;
const dayFilters = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const getDraftKey = (sale, receiptItemId) => receiptItemId ? `${sale.source}:item:${receiptItemId}` : getSaleKey(sale);
function AdminPricingPanel() {
    const [sales, setSales] = (0, react_1.useState)([]);
    const groupedSales = (0, react_1.useMemo)(() => (0, unpricedReceiptGrouping_1.groupMarketingUnpricedSales)(sales), [sales]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [buyingDrafts, setBuyingDrafts] = (0, react_1.useState)({});
    const [pricingKey, setPricingKey] = (0, react_1.useState)(null);
    const [deletingKey, setDeletingKey] = (0, react_1.useState)(null);
    const [search, setSearch] = (0, react_1.useState)("");
    const [sourceFilter, setSourceFilter] = (0, react_1.useState)("");
    const [attendantFilter, setAttendantFilter] = (0, react_1.useState)("");
    const [paymentFilter, setPaymentFilter] = (0, react_1.useState)("");
    const [dayFilter, setDayFilter] = (0, react_1.useState)("");
    const [dateFilter, setDateFilter] = (0, react_1.useState)("");
    const [receiptFilter, setReceiptFilter] = (0, react_1.useState)("");
    const fetchSales = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/marketing/unpriced-sales", { cache: "no-store", credentials: "same-origin" });
            if (!res.ok)
                throw new Error("Failed to load unpriced sales");
            const data = await res.json();
            setSales(data?.sales ?? []);
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to load unpriced sales", "error");
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchSales();
        const id = setInterval(fetchSales, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);
    const attendantOptions = (0, react_1.useMemo)(() => {
        const map = new Map();
        groupedSales.forEach((sale) => {
            const key = (sale.attendantEmail || sale.attendantName || "").toLowerCase();
            if (!key)
                return;
            const label = sale.attendantEmail
                ? `${sale.attendantName || "Unknown"} (${sale.attendantEmail})`
                : sale.attendantName;
            if (label)
                map.set(key, label);
        });
        return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
    }, [groupedSales]);
    const filteredSales = (0, react_1.useMemo)(() => {
        let rows = [...groupedSales];
        if (sourceFilter) {
            rows = rows.filter((sale) => sale.source === sourceFilter);
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter((sale) => sale.productName.toLowerCase().includes(q) ||
                sale.attendantName.toLowerCase().includes(q) ||
                (sale.attendantEmail ?? "").toLowerCase().includes(q) ||
                (sale.receiptNumber ?? "").toLowerCase().includes(q));
        }
        if (attendantFilter) {
            rows = rows.filter((sale) => {
                const matchKey = (sale.attendantEmail || sale.attendantName || "").toLowerCase();
                return matchKey === attendantFilter;
            });
        }
        if (paymentFilter) {
            if (paymentFilter === "NONE") {
                rows = rows.filter((sale) => !sale.paymentMethod);
            }
            else {
                rows = rows.filter((sale) => sale.paymentMethod === paymentFilter);
            }
        }
        if (dayFilter) {
            rows = rows.filter((sale) => (sale.day || "").toLowerCase() === dayFilter.toLowerCase());
        }
        if (dateFilter) {
            rows = rows.filter((sale) => {
                const dateStr = new Date(sale.saleDate).toISOString().split("T")[0];
                return dateStr === dateFilter;
            });
        }
        if (receiptFilter === "with") {
            rows = rows.filter((sale) => Boolean(sale.receiptNumber));
        }
        else if (receiptFilter === "without") {
            rows = rows.filter((sale) => !sale.receiptNumber);
        }
        return rows;
    }, [groupedSales, search, sourceFilter, attendantFilter, paymentFilter, dayFilter, dateFilter, receiptFilter]);
    const queueStats = (0, react_1.useMemo)(() => {
        return filteredSales.reduce((acc, sale) => {
            acc.total += 1;
            if (sale.source === "support") {
                acc.support += 1;
                const pending = sale.receiptItems?.length ?? sale.itemsPending ?? 0;
                if (pending > 0) {
                    acc.items += pending;
                }
                else {
                    const fallback = sale.itemsPending ?? 0;
                    acc.items += fallback > 0 ? fallback : 1;
                }
            }
            else {
                const pending = (sale.groupedSaleIds?.length ?? sale.itemsPending ?? 1) || 1;
                acc.items += pending;
            }
            return acc;
        }, { total: 0, support: 0, items: 0 });
    }, [filteredSales]);
    const handleSetDraft = (key, value) => {
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
    const submitPrice = async (sale, receiptItemId, buyingPrice, options) => {
        if (sale.source === "support" && !receiptItemId) {
            throw new Error("Select a receipt item to price");
        }
        const targetSaleId = options?.overrideSaleId ?? sale.id;
        const endpoint = sale.source === "support" ? "/api/support/price-sale" : "/api/marketing/price-sale";
        const payload = sale.source === "support"
            ? { receiptItemId, buyingPrice }
            : { dailySaleId: targetSaleId, buyingPrice };
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "same-origin",
        });
        if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.error || "Failed to save buying price");
        }
        setSales((prev) => {
            if (sale.source === "support") {
                const next = [];
                for (const row of prev) {
                    if (row.id !== sale.id || row.source !== sale.source) {
                        next.push(row);
                        continue;
                    }
                    if (receiptItemId) {
                        const remaining = (row.receiptItems || []).filter((item) => item.id !== receiptItemId);
                        if (!remaining.length) {
                            continue;
                        }
                        next.push({
                            ...row,
                            receiptItems: remaining,
                            itemsPending: Math.max(0, (row.itemsPending ?? remaining.length + 1) - 1),
                        });
                        continue;
                    }
                }
                return next;
            }
            return prev.filter((row) => row.id !== targetSaleId);
        });
    };
    const handlePriceSale = async (sale, receiptItemId) => {
        const receiptItems = sale.receiptItems;
        if (sale.source === "daily-sale" && (receiptItems?.length ?? 0) > 0) {
            await handlePriceReceiptGroup(sale);
            return;
        }
        const draftKey = getDraftKey(sale, receiptItemId);
        const draft = buyingDrafts[draftKey];
        const numeric = Number(draft);
        if (!draft || Number.isNaN(numeric) || numeric <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "error");
            return;
        }
        setPricingKey(draftKey);
        try {
            await submitPrice(sale, receiptItemId, Math.round(numeric));
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
            setPricingKey(null);
        }
    };
    const handlePriceSupportReceipt = async (sale) => {
        const draftKey = getDraftKey(sale);
        const draft = buyingDrafts[draftKey];
        const numeric = Number(draft);
        if (!draft || Number.isNaN(numeric) || numeric <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "error");
            return;
        }
        const items = sale.receiptItems || [];
        if (!items.length) {
            (0, toast_1.showToast)("No receipt items available for pricing", "error");
            return;
        }
        const allocations = allocateReceiptBuyingPrices(Math.round(numeric), items);
        setPricingKey(draftKey);
        try {
            for (const { id, value } of allocations) {
                await submitPrice(sale, id, value);
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
            setPricingKey(null);
        }
    };
    const handlePriceReceiptGroup = async (sale) => {
        const draftKey = getDraftKey(sale);
        const draft = buyingDrafts[draftKey];
        const numeric = Number(draft);
        if (!draft || Number.isNaN(numeric) || numeric <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "error");
            return;
        }
        const items = sale.receiptItems ?? [];
        if (!items.length) {
            (0, toast_1.showToast)("No receipt items available for pricing", "error");
            return;
        }
        const allocations = allocateReceiptBuyingPrices(Math.round(numeric), items);
        setPricingKey(draftKey);
        try {
            for (const { id, value } of allocations) {
                await submitPrice(sale, undefined, value, { overrideSaleId: id });
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
            setPricingKey(null);
        }
    };
    const handleDeleteSale = async (sale) => {
        const key = getSaleKey(sale);
        if (!window.confirm("Remove this sale from the pricing queue?"))
            return;
        setDeletingKey(key);
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
                    throw new Error(err?.error || "Failed to delete sale");
                }
            }
            (0, toast_1.showToast)("Sale removed from queue", "success");
            setSales((prev) => prev.filter((row) => !(sale.groupedSaleIds ?? [sale.id]).includes(row.id)));
            setBuyingDrafts((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to delete sale", "error");
        }
        finally {
            setDeletingKey(null);
        }
    };
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/70 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Manual pricing queue" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Admins can price pending sales on behalf of attendants. Details include the original attendant and receipt info." })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: fetchSales, disabled: loading, children: loading ? "Refreshing…" : "Refresh" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-3", children: [(0, jsx_runtime_1.jsx)(Input_1.default, { placeholder: "Search product, receipt, or attendant", value: search, onChange: (e) => setSearch(e.target.value), className: "flex-1" }), (0, jsx_runtime_1.jsxs)("select", { value: sourceFilter, onChange: (e) => setSourceFilter(e.target.value), className: "rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All sources" }), (0, jsx_runtime_1.jsx)("option", { value: "daily-sale", children: "Daily report" }), (0, jsx_runtime_1.jsx)("option", { value: "support", children: "Support entry" })] }), (0, jsx_runtime_1.jsxs)("select", { value: attendantFilter, onChange: (e) => setAttendantFilter(e.target.value), className: "rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All attendants" }), attendantOptions.map((option) => ((0, jsx_runtime_1.jsx)("option", { value: option.value, children: option.label }, option.value)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("select", { value: paymentFilter, onChange: (e) => setPaymentFilter(e.target.value), className: "rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All payment methods" }), (0, jsx_runtime_1.jsx)("option", { value: "MPESA", children: "MPESA" }), (0, jsx_runtime_1.jsx)("option", { value: "CASH", children: "Cash" }), (0, jsx_runtime_1.jsx)("option", { value: "NONE", children: "No payment data" })] }), (0, jsx_runtime_1.jsxs)("select", { value: dayFilter, onChange: (e) => setDayFilter(e.target.value), className: "rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All days" }), dayFilters.map((day) => ((0, jsx_runtime_1.jsx)("option", { value: day, children: day }, day)))] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "date", value: dateFilter, onChange: (e) => setDateFilter(e.target.value), className: "flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" }), (0, jsx_runtime_1.jsxs)("select", { value: receiptFilter, onChange: (e) => setReceiptFilter(e.target.value), className: "rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All receipts" }), (0, jsx_runtime_1.jsx)("option", { value: "with", children: "With receipt number" }), (0, jsx_runtime_1.jsx)("option", { value: "without", children: "Without receipt number" })] })] })] }), filteredSales.length > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 text-xs uppercase tracking-wide text-slate-300 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] text-slate-500", children: "Pending receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-white", children: queueStats.total })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] text-slate-500", children: "Pending items" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-white", children: queueStats.items })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] text-slate-500", children: "Support receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-white", children: queueStats.support })] })] })) : null, loading && sales.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400", children: "Loading unpriced sales\u2026" })) : null, !loading && filteredSales.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400", children: "No pending sales in the current trading period." })) : null, filteredSales.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-xl border border-slate-800", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-slate-950/50 text-left text-xs uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Product" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Attendant" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Sale info" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Buying price" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: filteredSales.map((sale) => {
                                const key = getSaleKey(sale);
                                const saleDate = new Date(sale.saleDate);
                                const receiptItems = sale.receiptItems;
                                const hasReceiptItems = (receiptItems?.length ?? 0) > 0;
                                const isSupportReceipt = sale.source === "support";
                                return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-slate-800 bg-slate-950/30", children: [(0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-3 align-top", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: sale.productName }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: sourceLabels[sale.source] }), sale.day ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-500", children: ["Day: ", sale.day] })) : null] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-3 align-top", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-white", children: sale.attendantName }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: sale.attendantEmail || "No email" })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-3 align-top text-xs text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: [saleDate.toLocaleDateString("en-KE"), " ", saleDate.toLocaleTimeString("en-KE")] }), (0, jsx_runtime_1.jsxs)("div", { children: [hasReceiptItems ? "Receipt value" : "Selling price", ": ", formatKES(sale.sellingPrice)] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Payment: ", sale.paymentMethod ?? "N/A"] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Receipt: ", sale.receiptNumber || "N/A"] }), hasReceiptItems ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-[10px] uppercase tracking-wide text-slate-500", children: [((sale.itemsPending ?? sale.receiptItems?.length ?? 0) || 0).toLocaleString(), " pending", sale.itemsTotal ? ` of ${sale.itemsTotal}` : "", " items"] })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-[10px] uppercase tracking-wide text-slate-500", children: "1 item pending" }))] }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3 align-top", children: hasReceiptItems ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-300", children: (0, jsx_runtime_1.jsx)("ul", { className: "list-disc space-y-1 pl-4 text-slate-100", children: receiptItems.map((item) => ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsx)("span", { children: item.productName || "Receipt item" }), typeof item.saleValue === "number" ? ((0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: formatKES(item.saleValue) })) : null] }, item.id))) }) }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: "0", step: "50", value: buyingDrafts[getDraftKey(sale)] ?? "", placeholder: "Total buying price", onChange: (e) => handleSetDraft(getDraftKey(sale), e.target.value) })] })) : ((0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: "0", step: "50", value: buyingDrafts[getDraftKey(sale)] ?? "", placeholder: "Buying price", onChange: (e) => handleSetDraft(getDraftKey(sale), e.target.value) })) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-3 align-top space-y-2", children: [hasReceiptItems ? ((0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => (isSupportReceipt ? handlePriceSupportReceipt(sale) : handlePriceReceiptGroup(sale)), disabled: pricingKey === getDraftKey(sale), className: "w-full bg-emerald-500 text-black font-semibold hover:brightness-95", children: pricingKey === getDraftKey(sale) ? "Saving…" : "Price receipt" })) : ((0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => handlePriceSale(sale), disabled: pricingKey === getDraftKey(sale), className: "w-full bg-emerald-500 text-black font-semibold hover:brightness-95", children: pricingKey === getDraftKey(sale) ? "Saving…" : "Price sale" })), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDeleteSale(sale), disabled: deletingKey === key, className: "w-full rounded-xl border border-red-500/60 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60", children: deletingKey === key ? "Removing…" : "Remove" })] })] }, key));
                            }) })] }) }))] }));
}
