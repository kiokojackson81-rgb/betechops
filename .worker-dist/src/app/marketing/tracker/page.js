"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MarketingTrackerPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const Textarea_1 = __importDefault(require("@/app/_components/Textarea"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const ReceiptsEditor_1 = __importDefault(require("@/app/_components/ReceiptsEditor"));
const toast_1 = require("@/lib/ui/toast");
const marketingDayConfigs_1 = require("@/lib/marketingDayConfigs");
const navigation_1 = require("next/navigation");
const getLandingPage_1 = __importDefault(require("@/lib/getLandingPage"));
const marketingCommission_1 = require("@/lib/marketingCommission");
const react_2 = require("next-auth/react");
const lucide_react_1 = require("lucide-react");
const useCardLock_1 = require("@/app/_components/useCardLock");
const getUnpricedSaleKey = (sale) => `${sale.source}:${sale.id}`;
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
function StatsCard({ periodLabel, receipts, salesKes, items, commissionKes, currentSalesForTier, nextTarget, }) {
    const hasNextTier = typeof nextTarget === "number" && nextTarget > 0;
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("marketing:quickstats");
    const mask = (val) => (locked ? "•••" : val);
    const remaining = hasNextTier && nextTarget > currentSalesForTier
        ? nextTarget - currentSalesForTier
        : 0;
    const progress = hasNextTier && nextTarget
        ? Math.min((currentSalesForTier / nextTarget) * 100, 100)
        : 100;
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "h-full border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-6 flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold", children: "Quick stats" }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 text-right", children: periodLabel })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 sm:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(receipts) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Sales (KES)" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(salesKes.toLocaleString()) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Commission (KES)" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(commissionKes.toLocaleString()) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Items sold" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-2xl font-semibold text-emerald-400", children: mask(items) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "To next tier" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs sm:text-sm text-slate-200", children: hasNextTier && remaining > 0
                            ? `KES ${remaining.toLocaleString()} more to hit next tier`
                            : "You’ve reached the top tier for this period 🎉" }), (0, jsx_runtime_1.jsx)("div", { className: "h-2 w-full overflow-hidden rounded-full bg-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-emerald-500", style: { width: `${progress}%` } }) })] })] }));
}
function EarningsCard({ summary }) {
    if (!summary)
        return null;
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("marketing:earnings");
    const mask = (v) => (locked ? "•••" : v);
    const rows = [
        { label: "Base salary", type: "earning", amount: summary.baseSalary },
        { label: "Commission", type: "earning", amount: summary.commission },
        { label: "Transport allowance", type: "earning", amount: summary.transportAllowance },
        { label: "Bonuses / extras", type: "earning", amount: summary.bonusTotal },
        { label: "Chama", type: "deduction", amount: summary.chamaTotal },
        { label: "Lateness", type: "deduction", amount: summary.latenessTotal },
        { label: "Disciplinary", type: "deduction", amount: summary.disciplineTotal },
        { label: "Other deductions", type: "deduction", amount: summary.otherDeductionsTotal },
    ].filter((row) => row.amount && row.amount !== 0);
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-4 flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Earnings this period" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: summary.periodLabel })] }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right text-xs", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-slate-400 uppercase tracking-wide", children: "Net pay" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xl font-semibold text-emerald-400", children: mask(`KES ${summary.netPay.toLocaleString()}`) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2 text-sm", children: rows.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-300", children: row.label }), (0, jsx_runtime_1.jsx)("span", { className: row.type === "earning"
                                ? "font-semibold text-emerald-400"
                                : "font-semibold text-rose-400", children: mask(`${row.type === "deduction" ? "-" : ""}KES ${row.amount.toLocaleString()}`) })] }, row.label))) })] }));
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
    // explicitly submits — serverPeriodSummary is updated by the poll.
    const [serverPeriodSummary, setServerPeriodSummary] = (0, react_1.useState)(null);
    const [earningsSummary, setEarningsSummary] = (0, react_1.useState)(null);
    const [unpricedSales, setUnpricedSales] = (0, react_1.useState)([]);
    const [buyingDrafts, setBuyingDrafts] = (0, react_1.useState)({});
    const [currentUserEmail, setCurrentUserEmail] = (0, react_1.useState)(null);
    const [deletingSaleKey, setDeletingSaleKey] = (0, react_1.useState)(null);
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
    const handleSetBuyingDraft = (sale, value) => {
        const key = getUnpricedSaleKey(sale);
        setBuyingDrafts((prev) => ({ ...prev, [key]: value }));
    };
    const handleSubmitBuyingPrice = async (sale) => {
        const key = getUnpricedSaleKey(sale);
        const rawValue = buyingDrafts[key] ?? "";
        const parsedValue = Number(rawValue);
        if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
            (0, toast_1.showToast)("Enter a valid buying price", "error");
            return;
        }
        const buyingPrice = Math.round(parsedValue);
        try {
            const endpoint = sale.source === "support" ? "/api/support/price-sale" : "/api/marketing/price-sale";
            const body = sale.source === "support"
                ? { receiptItemId: sale.id, buyingPrice }
                : { dailySaleId: sale.id, buyingPrice };
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                (0, toast_1.showToast)(err?.error || "Failed to save buying price", "error");
                return;
            }
            const data = await res.json().catch(() => null);
            (0, toast_1.showToast)("Buying price saved", "success");
            setUnpricedSales((prev) => prev.filter((row) => !(row.id === sale.id && row.source === sale.source)));
            setBuyingDrafts((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            if (data?.saleValue) {
                const methodKey = sale.paymentMethod === "CASH" ? "totalSalesCash" : "totalSalesMpesa";
                setServerPeriodSummary((prev) => {
                    if (!prev)
                        return prev;
                    const updatedPaymentStats = {
                        ...prev.aggregates.paymentStats,
                        [methodKey]: (prev.aggregates.paymentStats[methodKey] ?? 0) + data.saleValue,
                    };
                    return {
                        ...prev,
                        aggregates: {
                            ...prev.aggregates,
                            totalSales: prev.aggregates.totalSales + data.saleValue,
                            totalItems: prev.aggregates.totalItems + 1,
                            paymentStats: updatedPaymentStats,
                        },
                    };
                });
                // Also update earnings summary immediately by recalculating commission
                try {
                    setEarningsSummary((prev) => {
                        if (!prev)
                            return prev;
                        const currentTotalSales = serverPeriodSummary?.aggregates?.totalSales ?? 0;
                        const newTotalSales = currentTotalSales + data.saleValue;
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
                catch (err) {
                    // ignore any client-side calculation errors
                }
            }
        }
        catch (err) {
            (0, toast_1.showToast)("Failed to save buying price", "error");
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
            const res = await fetch("/api/marketing/unpriced-sales/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ saleId: sale.id, source: sale.source }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                (0, toast_1.showToast)(err?.error || "Failed to delete sale", "error");
                return;
            }
            setUnpricedSales((prev) => prev.filter((row) => getUnpricedSaleKey(row) !== key));
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
                    router.replace("/attendant/login");
                    return;
                }
                const data = await res.json().catch(() => null);
                const user = data?.user;
                if (!user) {
                    router.replace("/attendant/login");
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
                router.replace("/attendant/login");
            }
        })();
    }, [router]);
    // fetch + poll period summary so Quick stats stay in sync with server
    (0, react_1.useEffect)(() => {
        const POLL_INTERVAL_MS = 15000; // poll every 15s
        const controller = new AbortController();
        const buildSummaryFrom = (data) => ({
            period: {
                key: data.period?.key ?? "",
                label: data.period?.label ?? "",
                start: data.period?.start ?? "",
                end: data.period?.end ?? "",
            },
            aggregates: {
                totalSales: data.aggregates?.totalSales ?? 0,
                totalItems: data.aggregates?.totalItems ?? 0,
                paymentStats: data.aggregates?.paymentStats ?? {
                    totalSalesMpesa: 0,
                    totalSalesCash: 0,
                },
                commission: {
                    commission: data.aggregates?.commission?.commission ?? 0,
                },
            },
        });
        const fetchSummary = async () => {
            try {
                if (typeof document !== "undefined" && document.visibilityState === "hidden")
                    return;
                const imp = impersonateIdFromWindow();
                const url = imp
                    ? `/api/marketing/report/summary?impersonateId=${encodeURIComponent(imp)}`
                    : "/api/marketing/report/summary";
                const res = await fetch(url, { credentials: "same-origin", signal: controller.signal });
                if (!res.ok)
                    return;
                const data = await res.json().catch(() => null);
                if (!data)
                    return;
                const next = buildSummaryFrom(data);
                // update authoritative server-side summary but do NOT show the panel
                // unless the attendant explicitly submitted (periodSummary is used
                // for the visible panel). This keeps Quick stats accurate while the
                // panel remains hidden.
                setServerPeriodSummary((prev) => {
                    if (!prev)
                        return next;
                    const changed = prev.aggregates.totalSales !== next.aggregates.totalSales ||
                        prev.aggregates.totalItems !== next.aggregates.totalItems ||
                        prev.aggregates.paymentStats.totalSalesMpesa !== next.aggregates.paymentStats.totalSalesMpesa ||
                        prev.aggregates.paymentStats.totalSalesCash !== next.aggregates.paymentStats.totalSalesCash ||
                        prev.aggregates.commission.commission !== next.aggregates.commission.commission ||
                        prev.period.label !== next.period.label;
                    return changed ? next : prev;
                });
            }
            catch (err) {
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
    }, []);
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
                const prevStr = JSON.stringify(earningsSummary ?? {});
                const nextStr = JSON.stringify(next ?? {});
                if (next && prevStr !== nextStr)
                    setEarningsSummary(next);
            }
            catch (err) {
                // ignore network/abort errors
            }
        };
        fetchEarnings();
        const id = setInterval(fetchEarnings, POLL_INTERVAL_MS);
        return () => {
            clearInterval(id);
            controller.abort();
        };
    }, [ /* intentionally no deps to poll */]);
    (0, react_1.useEffect)(() => {
        const POLL_INTERVAL_MS = 20000;
        if (!currentUserEmail || currentUserEmail !== "jeniffer@betech.co.ke") {
            setUnpricedSales([]);
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
                setUnpricedSales(data.sales);
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
        const totalProfit = receipts.reduce((sum, r) => sum +
            ((typeof r.sellingTotal === "number"
                ? r.sellingTotal
                : Number(r.sellingTotal || 0)) -
                r.items.reduce((s, it) => s +
                    (typeof it.buyingPrice === "number"
                        ? it.buyingPrice
                        : Number(it.buyingPrice || 0)), 0)), 0);
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
    const periodLabel = periodSummary?.period.label ?? serverPeriodSummary?.period.label ?? "Nov 25, 2025 – Dec 24, 2025";
    const displayedSalesKes = combinedPeriodSales;
    const displayedItems = combinedPeriodItems;
    const displayedReceipts = combinedPeriodReceipts;
    const updateReceipt = (id, patch) => {
        setReceipts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };
    const addReceipt = () => setReceipts((rows) => [...rows, newSaleRow()]);
    const removeReceipt = (id) => setReceipts((rows) => rows.length > 1 ? rows.filter((r) => r.id !== id) : rows);
    const addItem = (receiptId) => {
        setReceipts((rows) => rows.map((r) => r.id === receiptId
            ? {
                ...r,
                items: [
                    ...r.items,
                    {
                        id: typeof crypto !== "undefined" &&
                            typeof crypto.randomUUID === "function"
                            ? crypto.randomUUID()
                            : Math.random().toString(36).slice(2),
                        productName: "",
                        buyingPrice: "",
                    },
                ],
            }
            : r));
    };
    const updateItem = (receiptId, itemId, patch) => {
        setReceipts((rows) => rows.map((r) => r.id === receiptId
            ? {
                ...r,
                items: r.items.map((it) => it.id === itemId ? { ...it, ...patch } : it),
            }
            : r));
    };
    const removeItem = (receiptId, itemId) => {
        setReceipts((rows) => rows.map((r) => r.id === receiptId
            ? {
                ...r,
                items: r.items.filter((it) => it.id !== itemId).length > 0
                    ? r.items.filter((it) => it.id !== itemId)
                    : r.items,
            }
            : r));
    };
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
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, className: "mx-auto flex max-w-6xl flex-col gap-6 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-1", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Sales Operations Dashboard" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Every task you complete brings you closer to your next reward." })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-2", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => (0, react_2.signOut)({ callbackUrl: "/attendant/login" }), className: "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10", children: "Log out" }) })] }), periodSummary && ((0, jsx_runtime_1.jsx)(Card_1.default, { className: "border-emerald-700/60 bg-emerald-900/20 text-emerald-100 shadow-xl shadow-emerald-900/30", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Summary so far for this trading period" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: periodSummary.period.label }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-emerald-200", children: periodSummary.period.label })] }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", onClick: () => setPeriodSummary(null), children: "Hide" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Period sales" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xl font-semibold text-white", children: ["KES ", periodSummary.aggregates.totalSales.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Total items" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xl font-semibold text-white", children: periodSummary.aggregates.totalItems.toLocaleString() })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "MPESA vs Cash" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm", children: ["MPESA KES", " ", periodSummary.aggregates.paymentStats.totalSalesMpesa.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm", children: ["Cash KES", " ", periodSummary.aggregates.paymentStats.totalSalesCash.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Commission so far" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xl font-semibold text-white", children: ["KES", " ", periodSummary.aggregates.commission.commission.toLocaleString()] })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-emerald-200", children: "This panel auto-hides after 5 minutes. Commission shown is cumulative for the current trading period." })] }) })), (0, jsx_runtime_1.jsx)(Card_1.default, { className: "border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20", children: (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Date" }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-3", children: (0, jsx_runtime_1.jsx)(Input_1.default, { type: "date", value: form.date, onChange: (e) => setForm((prev) => ({ ...prev, date: e.target.value })), className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Day of week" }), (0, jsx_runtime_1.jsx)("select", { value: form.dayOfWeek, onChange: (e) => setForm((prev) => ({
                                            ...prev,
                                            dayOfWeek: e.target.value,
                                        })), className: "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100", children: dayOptions.map((day) => ((0, jsx_runtime_1.jsx)("option", { value: day, children: day }, day))) })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-12 items-start", children: [(0, jsx_runtime_1.jsx)("div", { className: "lg:col-span-8", children: (0, jsx_runtime_1.jsx)(ReceiptsEditor_1.default, { receipts: receipts, setReceipts: setReceipts, totals: totals }) }), (0, jsx_runtime_1.jsxs)("div", { className: "lg:col-span-4 space-y-4", children: [(0, jsx_runtime_1.jsx)(StatsCard, { periodLabel: periodLabel, receipts: displayedReceipts, salesKes: displayedSalesKes, items: displayedItems, commissionKes: commissionKes, currentSalesForTier: combinedPeriodSales, nextTarget: nextTarget }), (0, jsx_runtime_1.jsx)(EarningsCard, { summary: earningsSummary }), currentUserEmail === "jeniffer@betech.co.ke" && ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-3 flex items-center justify-between gap-2", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-sm font-semibold text-slate-100", children: "Sales needing buying price" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Attach buying price to attendants\u2019 sales to earn commission." })] }) }), unpricedSales.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "No pending sales. All sales in this period have buying prices." })) : ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 space-y-2 max-h-72 overflow-y-auto pr-1", children: unpricedSales.map((sale) => {
                                                const draftKey = getUnpricedSaleKey(sale);
                                                const isSupport = sale.source === "support";
                                                const isDeleting = deletingSaleKey === draftKey;
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/70 px-3 py-2 text-xs space-y-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-slate-100", children: sale.productName }), (0, jsx_runtime_1.jsx)("span", { className: "rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400", children: isSupport ? "Support ops" : "Marketing ops" })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDeleteUnpricedSale(sale), disabled: isDeleting, "aria-label": "Delete pending sale", title: "Delete sale", className: `rounded-full p-1 text-slate-500 transition hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50`, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between gap-2 text-[11px] text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: sale.attendantName }), (0, jsx_runtime_1.jsxs)("span", { children: ["#", sale.receiptNumber || "No receipt", " \uFFFD ", sale.paymentMethod || "N/A"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-[11px] text-slate-400", children: [(0, jsx_runtime_1.jsx)("span", { children: "Line value" }), (0, jsx_runtime_1.jsxs)("span", { children: ["KES ", sale.sellingPrice.toLocaleString()] })] }), typeof sale.receiptTotal === "number" && sale.receiptTotal > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-[11px] text-slate-500", children: [(0, jsx_runtime_1.jsx)("span", { children: "Receipt total" }), (0, jsx_runtime_1.jsxs)("span", { children: ["KES ", sale.receiptTotal.toLocaleString()] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 pt-1", children: [(0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", min: 0, placeholder: "Buying price", value: buyingDrafts[draftKey] ?? "", onChange: (e) => handleSetBuyingDraft(sale, e.target.value), className: "h-8 w-24 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleSubmitBuyingPrice(sale), className: "ml-auto h-8 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black hover:brightness-95", children: "Save" })] })] }, draftKey));
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
