"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SupportOpsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const react_2 = require("next-auth/react");
const lucide_react_1 = require("lucide-react");
const ReceiptsEditor_1 = __importDefault(require("@/app/_components/ReceiptsEditor"));
const Card_1 = __importDefault(require("@/app/_components/Card"));
const SensitiveValue_1 = __importDefault(require("@/components/SensitiveValue"));
const Button_1 = __importDefault(require("@/app/_components/Button"));
const toast_1 = require("@/lib/ui/toast");
const PeriodSwitcher_1 = __importDefault(require("@/app/_components/PeriodSwitcher"));
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingCommission_1 = require("@/lib/marketingCommission");
const getLandingPage_1 = __importDefault(require("@/lib/getLandingPage"));
const useCardLock_1 = require("@/app/_components/useCardLock");
const inputClasses = "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const safeLocale = (value, fallback = "0") => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num.toLocaleString() : fallback;
};
const createItem = () => ({
    id: crypto.randomUUID(),
    productName: "",
    buyingPrice: "",
});
const createReceipt = () => ({
    id: crypto.randomUUID(),
    receiptNumber: "",
    sellingTotal: "",
    paymentMethod: "",
    items: [createItem()],
});
function SupportOpsPage() {
    const router = (0, navigation_1.useRouter)();
    const [date, setDate] = (0, react_1.useState)(() => new Date().toISOString().split("T")[0]);
    const [dayOfWeek, setDayOfWeek] = (0, react_1.useState)(() => new Date().toLocaleDateString("en-KE", { weekday: "long" }));
    const [receipts, setReceipts] = (0, react_1.useState)([createReceipt()]);
    const [newBatteries, setNewBatteries] = (0, react_1.useState)("");
    const [changedBatteries, setChangedBatteries] = (0, react_1.useState)("");
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [initialized, setInitialized] = (0, react_1.useState)(false);
    const [serverSummary, setServerSummary] = (0, react_1.useState)(null);
    const [earningsSummary, setEarningsSummary] = (0, react_1.useState)(null);
    const currentPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const [selectedPeriod, setSelectedPeriod] = (0, react_1.useState)(currentPeriod);
    const selectedPeriodKey = selectedPeriod.key;
    const tradingPeriodLabel = selectedPeriod.label;
    // Guard route for support attendants
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/attendants/me", { credentials: "same-origin" });
                if (!res.ok) {
                    router.replace("/attendant/login");
                    return;
                }
                const data = await res.json().catch(() => null);
                if (cancelled)
                    return;
                const user = data?.user;
                if (!user) {
                    router.replace("/attendant/login");
                    return;
                }
                const category = user.attendantCategory;
                const role = user.role;
                if (role === "ADMIN" || category === "SUPPORT_OPS") {
                    setInitialized(true);
                    return;
                }
                router.replace((0, getLandingPage_1.default)(category, role));
            }
            catch {
                if (!cancelled)
                    router.replace("/attendant/login");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [router]);
    const fetchSummaries = (0, react_1.useCallback)(async () => {
        try {
            const summaryParams = new URLSearchParams({ periodKey: selectedPeriodKey });
            const earningsParams = new URLSearchParams({ periodKey: selectedPeriodKey });
            const [summaryRes, earningsRes] = await Promise.all([
                fetch(`/api/support/report/summary?${summaryParams.toString()}`, { credentials: "same-origin" }),
                fetch(`/api/support/earnings/summary?${earningsParams.toString()}`, { credentials: "same-origin" }),
            ]);
            if (summaryRes.ok) {
                const data = (await summaryRes.json().catch(() => null));
                if (data)
                    setServerSummary(data);
            }
            if (earningsRes.ok) {
                const data = (await earningsRes.json().catch(() => null));
                if (data)
                    setEarningsSummary(data);
            }
        }
        catch {
            // no-op; UI already reflects optimistic data
        }
    }, [selectedPeriodKey]);
    (0, react_1.useEffect)(() => {
        if (!initialized)
            return;
        fetchSummaries();
        const interval = setInterval(fetchSummaries, 15000);
        return () => clearInterval(interval);
    }, [fetchSummaries, initialized]);
    const totals = (0, react_1.useMemo)(() => {
        return receipts.reduce((acc, receipt) => {
            const sale = Number(receipt.sellingTotal || 0);
            acc.totalSales += sale;
            acc.totalItems += receipt.items.length;
            const buying = receipt.items.reduce((sum, item) => sum + Number(item.buyingPrice || 0), 0);
            acc.totalProfit += sale - buying;
            return acc;
        }, { totalSales: 0, totalProfit: 0, totalItems: 0 });
    }, [receipts]);
    const localPerformance = (0, react_1.useMemo)(() => ({
        new: Number(newBatteries || 0),
        changed: Number(changedBatteries || 0),
    }), [changedBatteries, newBatteries]);
    const combined = (0, react_1.useMemo)(() => {
        const aggregates = serverSummary?.aggregates;
        const base = {
            sales: aggregates?.totalSales ?? 0,
            receipts: aggregates?.totalReceipts ?? 0,
            items: aggregates?.totalItems ?? 0,
            newBatteries: aggregates?.newBatteries ?? 0,
            changedBatteries: aggregates?.changedBatteries ?? 0,
        };
        return {
            sales: base.sales + totals.totalSales,
            receipts: base.receipts + receipts.length,
            items: base.items + totals.totalItems,
            newBatteries: base.newBatteries + localPerformance.new,
            changedBatteries: base.changedBatteries + localPerformance.changed,
        };
    }, [localPerformance, receipts.length, serverSummary?.aggregates, totals]);
    const commissionSummary = (0, react_1.useMemo)(() => (0, marketingCommission_1.getCommissionSummaryForSales)(combined.sales), [combined.sales]);
    const performanceBonus = (combined.newBatteries + combined.changedBatteries) * 70;
    const commissionDisplay = typeof earningsSummary?.salesCommission === "number"
        ? earningsSummary.salesCommission
        : commissionSummary.commission;
    const handleReset = () => {
        setReceipts([createReceipt()]);
        setNewBatteries("");
        setChangedBatteries("");
        setError(null);
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitting)
            return;
        setSubmitting(true);
        setError(null);
        try {
            const payload = {
                date,
                dayOfWeek,
                receipts: receipts.map((receipt) => ({
                    receiptNumber: receipt.receiptNumber,
                    sellingTotal: receipt.sellingTotal === "" ? 0 : Number(receipt.sellingTotal),
                    paymentMethod: receipt.paymentMethod || "MPESA",
                    items: receipt.items.map((item) => ({
                        productName: item.productName,
                        buyingPrice: 0,
                    })),
                })),
                performance: {
                    newBatteries: localPerformance.new,
                    changedBatteries: localPerformance.changed,
                },
            };
            const res = await fetch("/api/support/daily", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const message = data?.error || "Failed to submit support report.";
                setError(message);
                (0, toast_1.showToast)(message, "error");
                return;
            }
            (0, toast_1.showToast)("Support report submitted", "success");
            handleReset();
            fetchSummaries();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to submit support report.";
            setError(message);
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setSubmitting(false);
        }
    };
    if (!initialized) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex min-h-screen items-center justify-center bg-slate-950 text-slate-200", children: (0, jsx_runtime_1.jsx)("p", { children: "Loading support dashboard." }) }));
    }
    const periodLabel = serverSummary?.period.label ?? tradingPeriodLabel;
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, className: "mx-auto max-w-6xl space-y-6 p-6", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Support Operations" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Sales capture, performance tracking, and quick earnings breakdown." })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => (0, react_2.signOut)({ callbackUrl: "/attendant/login" }), className: "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10", children: "Log out" })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Statistics period" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-slate-100", children: selectedPeriod.label }), selectedPeriodKey !== currentPeriod.key && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-amber-300", children: "Showing archived period." }))] }), (0, jsx_runtime_1.jsx)(PeriodSwitcher_1.default, { currentPeriod: currentPeriod, selectedPeriod: selectedPeriod, onSelectPeriod: setSelectedPeriod })] }) }), (0, jsx_runtime_1.jsx)(Card_1.default, { className: "border-slate-800 bg-slate-950/70", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Date" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CalendarIcon, { size: 16, className: "text-slate-400" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: date, onChange: (event) => {
                                                    setDate(event.target.value);
                                                    const next = new Date(event.target.value);
                                                    if (!Number.isNaN(next.getTime())) {
                                                        setDayOfWeek(next.toLocaleDateString("en-KE", { weekday: "long" }));
                                                    }
                                                }, className: inputClasses })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "w-full md:w-auto", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Day" }), (0, jsx_runtime_1.jsx)("select", { value: dayOfWeek, onChange: (event) => setDayOfWeek(event.target.value), className: inputClasses, children: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ((0, jsx_runtime_1.jsx)("option", { value: day, children: day }, day))) })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 lg:grid-cols-12", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 lg:col-span-8", children: [(0, jsx_runtime_1.jsx)(ReceiptsEditor_1.default, { receipts: receipts, setReceipts: setReceipts, totals: totals, hideBuyingPrice: true }), (0, jsx_runtime_1.jsxs)("section", { className: "space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Performance (Support Ops)" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Battery metrics" })] }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-full border border-emerald-500/30 px-3 py-1 text-xs text-emerald-200", children: "70 KES per battery" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)(NumberRow, { label: "New batteries written", value: newBatteries, onChange: setNewBatteries }), (0, jsx_runtime_1.jsx)(NumberRow, { label: "Batteries changed", value: changedBatteries, onChange: setChangedBatteries })] })] }), error && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200", children: error })), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap justify-end gap-3", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { type: "button", variant: "secondary", onClick: handleReset, className: "px-5", children: "Reset" }), (0, jsx_runtime_1.jsx)(Button_1.default, { type: "submit", variant: "primary", disabled: submitting, className: "bg-emerald-500 px-6 text-black hover:brightness-95 disabled:opacity-60", children: submitting ? "Submitting..." : "Submit report" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 lg:col-span-4", children: [(0, jsx_runtime_1.jsx)(SupportQuickStats, { periodLabel: periodLabel, receipts: combined.receipts, salesKes: combined.sales, items: combined.items, commissionKes: commissionDisplay, newBatteries: combined.newBatteries, changedBatteries: combined.changedBatteries, performanceBonus: performanceBonus, currentSalesForTier: combined.sales, nextTarget: commissionSummary.nextTarget ?? null }), (0, jsx_runtime_1.jsx)(SupportEarningsCard, { summary: earningsSummary })] })] })] }) }));
}
function SupportQuickStats({ periodLabel, receipts, salesKes, items, commissionKes, newBatteries, changedBatteries, performanceBonus, currentSalesForTier, nextTarget, }) {
    const totalBatteries = newBatteries + changedBatteries;
    const remaining = typeof nextTarget === "number" && nextTarget > currentSalesForTier
        ? nextTarget - currentSalesForTier
        : 0;
    const reachedTop = !nextTarget || remaining <= 0;
    const progress = typeof nextTarget === "number" && nextTarget > 0
        ? Math.min((currentSalesForTier / nextTarget) * 100, 100)
        : 100;
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("support:quickstats");
    const mask = (v) => (locked ? "•••" : v);
    const stats = [
        { label: "Receipts", value: safeLocale(receipts) },
        { label: "Sales (KES)", value: safeLocale(salesKes) },
        { label: "Items sold", value: safeLocale(items) },
        // commission shown using SensitiveValue so it can be hidden; unhide requires login
        {
            label: "Commission (KES)",
            value: ((0, jsx_runtime_1.jsx)(SensitiveValue_1.default, { value: commissionKes, format: (v) => `KES ${Number(v).toLocaleString()}`, storageKey: `support:commission`, forceHidden: locked, forceVisible: !locked })),
        },
        { label: "New batteries", value: safeLocale(newBatteries) },
        { label: "Changed batteries", value: safeLocale(changedBatteries) },
        { label: "Total batteries", value: safeLocale(totalBatteries) },
        {
            label: "Performance earnings",
            value: mask(`KES ${safeLocale(performanceBonus)}`),
        },
        // Placeholder total commission: commission + performance earnings
        {
            label: "Total commission",
            value: ((0, jsx_runtime_1.jsx)(SensitiveValue_1.default, { value: commissionKes + performanceBonus, format: (v) => `KES ${safeLocale(Number(v))}`, storageKey: `support:total-commission`, forceHidden: locked, forceVisible: !locked })),
        },
    ];
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-slate-100", children: "Quick stats" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: periodLabel })] }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid gap-3 grid-cols-1 sm:grid-cols-3", children: stats.map((stat) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl bg-slate-950/60 px-3 py-2 text-left", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: stat.label }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-lg font-semibold text-emerald-400", children: typeof stat.value === "string" || typeof stat.value === "number"
                                ? mask(stat.value)
                                : stat.value })] }, stat.label))) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Progress to next tier" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-200", children: reachedTop
                            ? "Reached highest tier for this period"
                            : `KES ${safeLocale(remaining)} more to unlock the next tier` }), (0, jsx_runtime_1.jsx)("div", { className: "h-2 w-full overflow-hidden rounded-full bg-slate-800", children: (0, jsx_runtime_1.jsx)("div", { className: "h-full rounded-full bg-emerald-500 transition-all", style: { width: `${progress}%` } }) })] })] }));
}
function SupportEarningsCard({ summary }) {
    const { locked, toggle } = (0, useCardLock_1.useCardLock)("support:earnings");
    if (!summary)
        return null;
    const mask = (v) => (locked ? "•••" : v);
    const credits = [
        { label: "Base salary", amount: summary.baseSalary },
        { label: "Performance bonus", amount: summary.batteryEarnings },
        { label: "Commission", amount: summary.salesCommission },
        { label: "Bonuses", amount: summary.bonusTotal },
    ].filter((row) => row.amount !== 0);
    const adjEntries = (summary?.adjustmentEntries ?? []);
    const debits = adjEntries && adjEntries.length > 0
        ? adjEntries.filter(e => String(e.adjustmentKind || "DEDUCTION").toUpperCase() === "DEDUCTION").map(e => ({ label: e.label || e.adjustmentType, amount: e.amount }))
        : [
            { label: "Chama", amount: summary.chamaTotal },
            { label: "Lateness", amount: summary.latenessTotal },
            { label: "Discipline", amount: summary.disciplineTotal },
            { label: "Other deductions", amount: summary.otherDeductionsTotal },
        ].filter((row) => row.amount !== 0);
    const formatCurrency = (value) => `KES ${value.toLocaleString()}`;
    return ((0, jsx_runtime_1.jsxs)(Card_1.default, { className: "space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Earnings this period" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: summary.periodLabel })] }), (0, jsx_runtime_1.jsx)(useCardLock_1.LockButton, { locked: locked, onToggle: toggle })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[11px] uppercase tracking-wide text-slate-400", children: "Net pay" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold text-emerald-300", children: mask(formatCurrency(summary.netPay)) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [credits.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-300", children: row.label }), (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-emerald-300", children: mask(formatCurrency(row.amount)) })] }, row.label))), debits.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-300", children: row.label }), (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-rose-300", children: mask(`-${formatCurrency(row.amount)}`) })] }, row.label)))] })] }));
}
function NumberRow({ label, value, onChange, }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-4", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-slate-100", children: label }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: value, onChange: (event) => onChange(event.target.value === "" ? "" : Number(event.target.value)), className: "w-28 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-right text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" })] }));
}
