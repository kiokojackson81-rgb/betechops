"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ManualWeeklySalesPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const ToastContainer_1 = __importDefault(require("@/app/_components/ToastContainer"));
const toast_1 = require("@/lib/ui/toast");
const client_1 = require("@prisma/client");
const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const initialFilters = { shopId: "", status: "", source: "" };
const toInputDate = (date) => date.toISOString().slice(0, 10);
const formatShort = (date) => date.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
function buildTradingWeeks(reference = new Date()) {
    const now = new Date(reference);
    now.setHours(0, 0, 0, 0);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const lastDayPrevMonth = new Date(currentYear, currentMonth, 0);
    const prevMonthYear = lastDayPrevMonth.getFullYear();
    const prevMonthIndex = lastDayPrevMonth.getMonth();
    const prevMonthMaxDay = lastDayPrevMonth.getDate();
    const clampPrevMonth = (day) => Math.min(day, prevMonthMaxDay);
    const week1Start = new Date(prevMonthYear, prevMonthIndex, 24);
    const week1End = new Date(prevMonthYear, prevMonthIndex, clampPrevMonth(30));
    const week2Start = new Date(currentYear, currentMonth, 1);
    const week2End = new Date(currentYear, currentMonth, 7);
    const week3Start = new Date(currentYear, currentMonth, 8);
    const week3End = new Date(currentYear, currentMonth, 14);
    const week4Start = new Date(currentYear, currentMonth, 15);
    const week4End = new Date(currentYear, currentMonth, 21);
    const weeks = [
        {
            key: `week1-${toInputDate(week1Start)}`,
            label: "Week 1",
            display: `${formatShort(week1Start)} - ${formatShort(week1End)}`,
            startInput: toInputDate(week1Start),
            endInput: toInputDate(week1End),
            start: week1Start,
            end: week1End,
        },
        {
            key: `week2-${toInputDate(week2Start)}`,
            label: "Week 2",
            display: `${formatShort(week2Start)} - ${formatShort(week2End)}`,
            startInput: toInputDate(week2Start),
            endInput: toInputDate(week2End),
            start: week2Start,
            end: week2End,
        },
        {
            key: `week3-${toInputDate(week3Start)}`,
            label: "Week 3",
            display: `${formatShort(week3Start)} - ${formatShort(week3End)}`,
            startInput: toInputDate(week3Start),
            endInput: toInputDate(week3End),
            start: week3Start,
            end: week3End,
        },
        {
            key: `week4-${toInputDate(week4Start)}`,
            label: "Week 4",
            display: `${formatShort(week4Start)} - ${formatShort(week4End)}`,
            startInput: toInputDate(week4Start),
            endInput: toInputDate(week4End),
            start: week4Start,
            end: week4End,
        },
    ];
    let defaultWeek = weeks[0];
    for (const wk of weeks) {
        if (wk.end.getTime() < now.getTime()) {
            defaultWeek = wk;
        }
    }
    return { weeks, defaultWeek: defaultWeek ?? weeks[0] };
}
const buildInitialForm = (week) => ({
    shopId: "",
    weekStart: week?.startInput ?? "",
    weekEnd: week?.endInput ?? "",
    amount: "",
});
function ManualWeeklySalesPage() {
    const tradingWeeks = (0, react_1.useMemo)(() => buildTradingWeeks(), []);
    const initialWeek = tradingWeeks.defaultWeek ?? tradingWeeks.weeks[0];
    const [sales, setSales] = (0, react_1.useState)([]);
    const [shops, setShops] = (0, react_1.useState)([]);
    const [filters, setFilters] = (0, react_1.useState)(initialFilters);
    const [selectedWeekKey, setSelectedWeekKey] = (0, react_1.useState)(initialWeek?.key ?? "");
    const [form, setForm] = (0, react_1.useState)(() => buildInitialForm(initialWeek));
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const loadShops = (0, react_1.useCallback)(async () => {
        try {
            const res = await fetch("/api/admin/online/manual/shops", { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load shops");
            const data = (await res.json());
            setShops(Array.isArray(data) ? data : []);
        }
        catch (err) {
            console.error(err);
            (0, toast_1.showToast)("Unable to load shops", "error");
        }
    }, []);
    const loadSales = (0, react_1.useCallback)(async (nextFilters) => {
        const active = nextFilters ?? filters;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(active).forEach(([key, value]) => {
                if (value)
                    params.set(key, value);
            });
            const query = params.size ? `?${params.toString()}` : "";
            const res = await fetch(`/api/admin/weekly-sale${query}`, { cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load weekly sales");
            const data = (await res.json());
            setSales(Array.isArray(data) ? data : []);
        }
        catch (err) {
            console.error(err);
            (0, toast_1.showToast)("Unable to fetch weekly sales", "error");
        }
        finally {
            setLoading(false);
        }
    }, [filters]);
    (0, react_1.useEffect)(() => {
        loadShops();
        loadSales();
    }, [loadShops, loadSales]);
    const onFilterChange = (key, value) => {
        const next = { ...filters, [key]: value };
        setFilters(next);
        loadSales(next);
    };
    const onFormChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const selectedShop = (0, react_1.useMemo)(() => shops.find((shop) => shop.id === form.shopId) || null, [shops, form.shopId]);
    const selectedAssignee = selectedShop?.primaryAttendant ?? null;
    const selectedWeek = (0, react_1.useMemo)(() => tradingWeeks.weeks.find((wk) => wk.key === selectedWeekKey) ??
        tradingWeeks.defaultWeek ??
        tradingWeeks.weeks[0], [tradingWeeks, selectedWeekKey]);
    const takenShopIdsForWeek = (0, react_1.useMemo)(() => {
        if (!form.weekStart || !form.weekEnd)
            return [];
        const manualSet = new Set();
        sales.forEach((sale) => {
            if (!sale.shopId)
                return;
            const saleWeekStart = new Date(sale.weekStart).toISOString().slice(0, 10);
            const saleWeekEnd = new Date(sale.weekEnd).toISOString().slice(0, 10);
            if (saleWeekStart === form.weekStart &&
                saleWeekEnd === form.weekEnd &&
                sale.source === client_1.WeeklySaleSource.MANUAL) {
                manualSet.add(sale.shopId);
            }
        });
        return Array.from(manualSet);
    }, [sales, form.weekStart, form.weekEnd]);
    const takenShopSet = (0, react_1.useMemo)(() => new Set(takenShopIdsForWeek), [takenShopIdsForWeek]);
    const autoShopIdsForWeek = (0, react_1.useMemo)(() => {
        if (!form.weekStart || !form.weekEnd)
            return [];
        const autoSet = new Set();
        sales.forEach((sale) => {
            if (!sale.shopId)
                return;
            const saleWeekStart = new Date(sale.weekStart).toISOString().slice(0, 10);
            const saleWeekEnd = new Date(sale.weekEnd).toISOString().slice(0, 10);
            if (saleWeekStart === form.weekStart &&
                saleWeekEnd === form.weekEnd &&
                sale.source === client_1.WeeklySaleSource.AUTOMATIC) {
                autoSet.add(sale.shopId);
            }
        });
        return Array.from(autoSet);
    }, [sales, form.weekStart, form.weekEnd]);
    const autoShopSet = (0, react_1.useMemo)(() => new Set(autoShopIdsForWeek), [autoShopIdsForWeek]);
    const availableShops = (0, react_1.useMemo)(() => shops.filter((shop) => !takenShopSet.has(shop.id)), [shops, takenShopSet]);
    (0, react_1.useEffect)(() => {
        if (form.shopId && takenShopSet.has(form.shopId)) {
            setForm((prev) => ({ ...prev, shopId: "" }));
        }
    }, [form.shopId, takenShopSet]);
    const handleWeekSelect = (key) => {
        const week = tradingWeeks.weeks.find((wk) => wk.key === key);
        if (!week)
            return;
        setSelectedWeekKey(key);
        setForm((prev) => ({ ...prev, shopId: "", weekStart: week.startInput, weekEnd: week.endInput }));
    };
    const createEntry = async () => {
        if (!form.shopId || !form.weekStart || !form.weekEnd || !form.amount) {
            (0, toast_1.showToast)("Please provide shop, week range and amount", "error");
            return;
        }
        const assignedUserId = selectedAssignee?.id ?? null;
        setSaving(true);
        try {
            const payload = {
                shopId: form.shopId,
                weekStart: form.weekStart,
                weekEnd: form.weekEnd,
                amount: Number(form.amount),
                userId: assignedUserId,
            };
            const res = await fetch("/api/admin/weekly-sale", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || "Failed to create entry");
            }
            (0, toast_1.showToast)("Manual weekly sale saved", "success");
            const resetWeek = tradingWeeks.weeks.find((wk) => wk.key === selectedWeekKey) ?? initialWeek;
            setForm(buildInitialForm(resetWeek));
            await loadSales();
        }
        catch (err) {
            console.error(err);
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to create entry", "error");
        }
        finally {
            setSaving(false);
        }
    };
    const updateStatus = async (id, status) => {
        try {
            const res = await fetch(`/api/admin/weekly-sale/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!res.ok)
                throw new Error("Failed to update status");
            (0, toast_1.showToast)(`Entry ${status.toLowerCase()}`, "success");
            await loadSales();
        }
        catch (err) {
            console.error(err);
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to update entry", "error");
        }
    };
    const deleteEntry = async (id) => {
        if (!confirm("Delete this manual entry?"))
            return;
        try {
            const res = await fetch(`/api/admin/weekly-sale/${id}`, { method: "DELETE" });
            if (!res.ok)
                throw new Error("Failed to delete entry");
            (0, toast_1.showToast)("Entry deleted", "success");
            await loadSales();
        }
        catch (err) {
            console.error(err);
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to delete entry", "error");
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)(ToastContainer_1.default, {}), (0, jsx_runtime_1.jsxs)("header", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Online ops" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold text-white", children: "Manual weekly sales desk" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Capture overrides when Jumia/Kilimall statements fail to sync, approve pending entries, and keep commissions aligned with the source of truth." })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-slate-900/40 p-5", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: "Add manual entry" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-4 md:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-300", children: ["Shop", (0, jsx_runtime_1.jsxs)("select", { className: "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: form.shopId, onChange: (e) => onFormChange("shopId", e.target.value), disabled: availableShops.length === 0, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: availableShops.length === 0 ? "All shops captured for this week" : "Select shop" }), availableShops.map((shop) => ((0, jsx_runtime_1.jsxs)("option", { value: shop.id, children: [shop.displayName, " (", shop.platform, ")"] }, shop.id)))] }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-500", children: shops.length === 0
                                            ? "Loading shop assignments…"
                                            : `${availableShops.length} of ${shops.length} shops still open for ${selectedWeek?.display ?? "this week"}.` }), autoShopSet.size > 0 && ((0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-amber-300", children: autoShopSet.size === 1
                                            ? "1 shop already has an automatic entry this week; saving will overwrite it."
                                            : `${autoShopSet.size} shops already have automatic entries this week; saving will overwrite them.` })), selectedShop && autoShopSet.has(selectedShop.id) && ((0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-amber-300", children: "Manual entry will overwrite the automatic record for this shop." }))] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-300", children: ["Trading week", (0, jsx_runtime_1.jsx)("select", { className: "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: selectedWeekKey, onChange: (e) => handleWeekSelect(e.target.value), children: tradingWeeks.weeks.map((week) => ((0, jsx_runtime_1.jsxs)("option", { value: week.key, children: [week.label, " (", week.display, ")"] }, week.key))) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-300", children: ["Week start", (0, jsx_runtime_1.jsx)("input", { type: "date", className: "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: form.weekStart, onChange: (e) => onFormChange("weekStart", e.target.value) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-300", children: ["Week end", (0, jsx_runtime_1.jsx)("input", { type: "date", className: "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: form.weekEnd, onChange: (e) => onFormChange("weekEnd", e.target.value) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-sm text-slate-300", children: ["Amount (KES)", (0, jsx_runtime_1.jsx)("input", { type: "number", min: "0", className: "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: form.amount, onChange: (e) => onFormChange("amount", e.target.value) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300", children: selectedShop ? ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Attendant on file" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 font-semibold text-white", children: selectedAssignee?.name || selectedAssignee?.email || "Unassigned" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Shop platform" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 font-semibold text-white", children: selectedShop.platform })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Marketplace codes" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-400", children: selectedShop.identifiers?.jumiaShopSid
                                                ? `SID: ${selectedShop.identifiers.jumiaShopSid}`
                                                : selectedShop.identifiers?.kilimallShopCode
                                                    ? `Code: ${selectedShop.identifiers.kilimallShopCode}`
                                                    : "—" })] })] })) : ((0, jsx_runtime_1.jsx)("p", { children: "Select a shop to view the assigned attendant and identifiers for this trading period." })) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 rounded-2xl border border-white/5 bg-black/20 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-500", children: "Trading weeks" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4", children: tradingWeeks.weeks.map((week) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: week.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-base text-white", children: week.display })] }, week.key))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex flex-wrap gap-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: createEntry, disabled: saving, className: "rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60", children: saving ? "Saving." : "Save manual entry" }), (0, jsx_runtime_1.jsx)(link_1.default, { href: "/attendant/daily-report", className: "text-sm text-emerald-400 hover:text-emerald-200", children: "Need to record receipts? Open the daily report tool \u2192" })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-slate-900/40 p-5", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: "Weekly sales history" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Filter entries before approving so auto-sync and manual overrides never collide." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 sm:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("select", { className: "rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: filters.status, onChange: (e) => onFilterChange("status", e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All statuses" }), Object.values(client_1.WeeklySaleStatus).map((status) => ((0, jsx_runtime_1.jsx)("option", { value: status, children: status }, status)))] }), (0, jsx_runtime_1.jsxs)("select", { className: "rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: filters.source, onChange: (e) => onFilterChange("source", e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All sources" }), Object.values(client_1.WeeklySaleSource).map((source) => ((0, jsx_runtime_1.jsx)("option", { value: source, children: source }, source)))] }), (0, jsx_runtime_1.jsxs)("select", { className: "rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm", value: filters.shopId, onChange: (e) => onFilterChange("shopId", e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All shops" }), shops.map((shop) => ((0, jsx_runtime_1.jsx)("option", { value: shop.id, children: shop.displayName }, shop.id)))] })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full min-w-[760px] text-left text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "text-xs uppercase tracking-wide text-slate-400", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-2", children: "Shop" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2", children: "Week" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2", children: "Amount" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2", children: "Source" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2", children: "Assignee" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 text-right", children: "Actions" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [sales.map((sale) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-white/5 text-slate-100", children: [(0, jsx_runtime_1.jsxs)("td", { className: "py-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold", children: sale.shop?.name ?? "Unassigned" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: sale.platform })] }), (0, jsx_runtime_1.jsxs)("td", { className: "py-3 text-sm text-slate-200", children: [new Date(sale.weekStart).toLocaleDateString(), " - ", new Date(sale.weekEnd).toLocaleDateString()] }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 font-semibold text-emerald-300", children: currency.format(Number(sale.amount ?? 0)) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-xs text-slate-400", children: sale.source }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-xs font-semibold", children: (0, jsx_runtime_1.jsx)("span", { className: statusBadgeClass(sale.status), children: sale.status }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-sm text-slate-300", children: sale.user?.name || sale.user?.email || "-" }), (0, jsx_runtime_1.jsx)("td", { className: "py-3 text-right text-xs", children: sale.status === "PENDING" && ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-full bg-emerald-500/90 px-3 py-1 font-semibold text-black hover:brightness-95", onClick: () => updateStatus(sale.id, client_1.WeeklySaleStatus.APPROVED), children: "Approve" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-full border border-white/20 px-3 py-1 font-semibold text-slate-200 hover:bg-white/10", onClick: () => updateStatus(sale.id, client_1.WeeklySaleStatus.REJECTED), children: "Reject" }), sale.source === "MANUAL" && ((0, jsx_runtime_1.jsx)("button", { type: "button", className: "rounded-full border border-red-400/50 px-3 py-1 font-semibold text-red-200 hover:bg-red-500/10", onClick: () => deleteEntry(sale.id), children: "Delete" }))] })) })] }, sale.id))), !loading && sales.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 7, className: "py-6 text-center text-sm text-slate-500", children: "No weekly sales found for the selected filters." }) })), loading && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 7, className: "py-6 text-center text-sm text-slate-500", children: "Loading weekly sales." }) }))] })] }) })] })] }));
}
function statusBadgeClass(status) {
    switch (status) {
        case "APPROVED":
            return "rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300";
        case "REJECTED":
            return "rounded-full bg-red-500/10 px-3 py-1 text-red-300";
        default:
            return "rounded-full bg-amber-500/10 px-3 py-1 text-amber-200";
    }
}
