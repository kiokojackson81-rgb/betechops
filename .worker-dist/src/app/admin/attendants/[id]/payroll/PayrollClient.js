"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PayrollClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Button_1 = __importDefault(require("@/app/_components/Button"));
const Card_1 = __importDefault(require("@/app/_components/Card"));
const Input_1 = __importDefault(require("@/app/_components/Input"));
const toast_1 = require("@/lib/ui/toast");
function PayrollClient({ attendant, initialPlan, periodKey, periodLabel, initialAdjustments, initialSummary, ledger, previousLedger, }) {
    const [plan, setPlan] = (0, react_1.useState)(initialPlan
        ? { ...initialPlan }
        : {
            attendantId: attendant.id,
            baseSalary: 0,
            frequency: "PERIOD",
            defaultChamaDeduction: 0,
            defaultOtherDeduction: 0,
            defaultTransportAllowance: 0,
            notes: "",
        });
    const [adjustments, setAdjustments] = (0, react_1.useState)(initialAdjustments || []);
    const [summary, setSummary] = (0, react_1.useState)(initialSummary || null);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [loadingAdjustments, setLoadingAdjustments] = (0, react_1.useState)(false);
    const [newAdjustment, setNewAdjustment] = (0, react_1.useState)({ adjustmentType: "BONUS", label: "", amount: "", adjustmentKind: "ADDITION" });
    const commissionValue = initialSummary?.commission ??
        initialSummary?.grossCommission ??
        initialSummary?.salesCommission ??
        initialSummary?._raw?.commission ??
        initialSummary?._raw?.grossCommission ??
        initialSummary?._raw?.salesCommission ??
        0;
    const periodProfit = Number(initialSummary?.totalProfit ?? initialSummary?._raw?.totalProfit ?? 0);
    const periodReceipts = Number(initialSummary?.totalReceipts ?? initialSummary?._raw?.totalReceipts ?? 0);
    const periodItems = Number(initialSummary?.totalItems ?? initialSummary?._raw?.totalItems ?? 0);
    const ledgerTotals = (0, react_1.useMemo)(() => {
        const breakdown = ledger?.commissionBreakdown ?? {};
        return {
            direct: Number(ledger?.commissionDirect ?? breakdown?.direct ?? 0),
            jumia: Number(ledger?.commissionMarketplaceJumia ?? breakdown?.jumia ?? breakdown?.["marketplace:jumia"] ?? 0),
            kilimall: Number(ledger?.commissionMarketplaceKilimall ?? breakdown?.kilimall ?? breakdown?.["marketplace:kilimall"] ?? 0),
            netCommission: Number(ledger?.netCommission ?? initialSummary?._raw?.netCommission ?? 0),
        };
    }, [ledger, initialSummary]);
    const previousNetCommission = Number(previousLedger?.netCommission ?? 0);
    const netCommissionDelta = ledgerTotals.netCommission - previousNetCommission;
    const adjustmentTotals = (0, react_1.useMemo)(() => {
        const totals = {
            topUps: 0,
            deductions: 0,
            chama: 0,
            lateness: 0,
            discipline: 0,
            other: 0,
        };
        for (const adj of adjustments) {
            const amount = Number(adj.amount ?? 0);
            const type = adj.adjustmentType;
            const isAddition = type === "BONUS" || type === "COMMISSION_TOPUP";
            if (isAddition) {
                totals.topUps += amount;
            }
            if (!isAddition) {
                totals.deductions += amount;
            }
            if (type === "CHAMA")
                totals.chama += amount;
            if (type === "LATENESS")
                totals.lateness += amount;
            if (type === "DISCIPLINE")
                totals.discipline += amount;
            if (type === "OTHER")
                totals.other += amount;
        }
        return totals;
    }, [adjustments]);
    (0, react_1.useEffect)(() => {
        // fetch fresh adjustments and summary on mount
        fetchAdjustments();
        fetchSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function fetchAdjustments() {
        setLoadingAdjustments(true);
        try {
            const url = `/api/admin/attendants/${attendant.id}/payroll-adjustments?periodKey=${encodeURIComponent(periodKey)}`;
            const res = await fetch(url, { credentials: "same-origin" });
            if (!res.ok)
                throw new Error("Failed to load adjustments");
            const data = await res.json();
            setAdjustments(data.rows || []);
        }
        catch (err) {
            console.error(err);
            (0, toast_1.showToast)(err?.message || "Failed to load adjustments", "error");
        }
        finally {
            setLoadingAdjustments(false);
        }
    }
    async function fetchSummary() {
        try {
            const url = `/api/marketing/earnings/summary?attendantId=${encodeURIComponent(attendant.id)}`;
            const res = await fetch(url, { credentials: "same-origin" });
            if (!res.ok)
                return;
            const data = await res.json().catch(() => null);
            if (data?.summary)
                setSummary(data.summary);
        }
        catch (err) {
            // ignore
        }
    }
    const savePlan = async () => {
        if (!plan)
            return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/attendants/${attendant.id}/comp-plan`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(plan),
            });
            if (!res.ok)
                throw new Error("Failed to save");
            const data = await res.json();
            (0, toast_1.showToast)("Comp plan saved", "success");
            // refresh earnings summary after plan change
            fetchSummary();
        }
        catch (err) {
            (0, toast_1.showToast)(err?.message || "Failed to save comp plan", "error");
        }
        finally {
            setSaving(false);
        }
    };
    const addAdjustment = async () => {
        if (!newAdjustment.label || !newAdjustment.adjustmentType || newAdjustment.amount === "") {
            (0, toast_1.showToast)("Please fill type, label and amount", "error");
            return;
        }
        try {
            const body = {
                periodKey,
                periodLabel,
                adjustmentType: newAdjustment.adjustmentType,
                label: newAdjustment.label,
                amount: Number(newAdjustment.amount || 0),
                adjustmentKind: newAdjustment.adjustmentKind ?? "DEDUCTION",
            };
            const res = await fetch(`/api/admin/attendants/${attendant.id}/payroll-adjustments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to add adjustment");
            }
            (0, toast_1.showToast)("Adjustment added", "success");
            setNewAdjustment({ adjustmentType: "BONUS", label: "", amount: "" });
            await fetchAdjustments();
            await fetchSummary();
        }
        catch (err) {
            (0, toast_1.showToast)(err?.message || "Failed to add adjustment", "error");
        }
    };
    const deleteAdjustment = async (id) => {
        if (!confirm("Delete this adjustment?"))
            return;
        try {
            const url = `/api/admin/attendants/${attendant.id}/payroll-adjustments?adjustmentId=${encodeURIComponent(id)}`;
            const res = await fetch(url, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete");
            }
            (0, toast_1.showToast)("Adjustment deleted", "success");
            await fetchAdjustments();
            await fetchSummary();
        }
        catch (err) {
            (0, toast_1.showToast)(err?.message || "Failed to delete adjustment", "error");
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/60", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: attendant.name ?? attendant.email }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: "Payroll settings" })] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: savePlan, disabled: saving, children: "Save" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-3 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Base salary (KES)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: String(plan?.baseSalary ?? 0), onChange: (e) => setPlan(p => p ? { ...p, baseSalary: Number(e.target.value || 0) } : p) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Transport allowance (KES)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: String(plan?.defaultTransportAllowance ?? 0), onChange: (e) => setPlan(p => p ? { ...p, defaultTransportAllowance: Number(e.target.value || 0) } : p) })] })] })] }), (0, jsx_runtime_1.jsxs)(Card_1.default, { className: "border-slate-800 bg-slate-900/60", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between", children: (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)("h2", { className: "text-lg font-semibold", children: ["Current period \u2014 ", periodLabel] }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-3 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-300", children: "Period sales" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-emerald-400", children: ["KES ", initialSummary?.sales?.toLocaleString?.() ?? 0] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-300", children: "Commission" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-emerald-400", children: ["KES ", commissionValue.toLocaleString?.() ?? 0] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-slate-300", children: "Net pay" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-emerald-400", children: ["KES ", initialSummary?.netPay?.toLocaleString?.() ?? 0] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Profit" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", periodProfit.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Receipts" }), (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-slate-100", children: periodReceipts.toLocaleString() })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Items" }), (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-slate-100", children: periodItems.toLocaleString() })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Top-ups" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", adjustmentTotals.topUps.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Deductions" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", adjustmentTotals.deductions.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Lateness" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", adjustmentTotals.lateness.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Chama" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", adjustmentTotals.chama.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Discipline" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", adjustmentTotals.discipline.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Others" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", adjustmentTotals.other.toLocaleString()] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Direct commission" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["KES ", ledgerTotals.direct.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Marketplace" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["Jumia KES ", ledgerTotals.jumia.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Marketplace" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-slate-100", children: ["Kilimall KES ", ledgerTotals.kilimall.toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Net commission vs prev" }), (0, jsx_runtime_1.jsxs)("span", { className: `font-semibold ${netCommissionDelta >= 0 ? "text-emerald-300" : "text-rose-300"}`, children: [netCommissionDelta >= 0 ? "+" : "-", "KES ", Math.abs(netCommissionDelta).toLocaleString()] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-slate-200", children: "Adjustments" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 space-y-2", children: [adjustments.map((a) => {
                                                const kind = (a.adjustmentKind || a.kind || "DEDUCTION").toUpperCase();
                                                const isAddition = kind === "ADDITION";
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm", children: a.label }), (0, jsx_runtime_1.jsx)("div", { className: `text-[11px] font-semibold px-2 py-0.5 rounded-full ${isAddition ? "bg-emerald-700 text-emerald-100" : "bg-rose-800 text-rose-100"}`, children: isAddition ? "Addition" : "Deduction" })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: a.adjustmentType })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: `text-sm font-semibold ${isAddition ? "text-emerald-300" : "text-rose-300"}`, children: [isAddition ? "KES " : "KES -", Math.abs(Number(a.amount || 0)).toLocaleString()] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => deleteAdjustment(a.id), className: "text-xs rounded-full border border-red-600 px-2 py-1 text-rose-400 hover:bg-red-800/20", children: "Delete" })] })] }, a.id));
                                            }), adjustments.length === 0 && (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "No adjustments for this period." }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 rounded-xl border border-white/5 bg-slate-900/50 p-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 md:grid-cols-3 items-end", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Type" }), (0, jsx_runtime_1.jsxs)("select", { value: newAdjustment.adjustmentType, onChange: (e) => {
                                                                        const t = e.target.value;
                                                                        // default kind: bonuses and top-ups are additions, others are deductions
                                                                        const kind = t === "BONUS" || t === "COMMISSION_TOPUP" ? "ADDITION" : "DEDUCTION";
                                                                        setNewAdjustment((s) => ({ ...s, adjustmentType: t, adjustmentKind: kind }));
                                                                    }, className: "w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "CHAMA", children: "Chama" }), (0, jsx_runtime_1.jsx)("option", { value: "LATENESS", children: "Lateness" }), (0, jsx_runtime_1.jsx)("option", { value: "DISCIPLINE", children: "Disciplinary" }), (0, jsx_runtime_1.jsx)("option", { value: "BONUS", children: "Bonus" }), (0, jsx_runtime_1.jsx)("option", { value: "COMMISSION_TOPUP", children: "Top up" }), (0, jsx_runtime_1.jsx)("option", { value: "OTHER", children: "Others" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Kind" }), (0, jsx_runtime_1.jsxs)("select", { value: newAdjustment.adjustmentKind, onChange: (e) => setNewAdjustment((s) => ({ ...s, adjustmentKind: e.target.value })), className: "w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "ADDITION", children: "Addition" }), (0, jsx_runtime_1.jsx)("option", { value: "DEDUCTION", children: "Deduction" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Label" }), (0, jsx_runtime_1.jsx)(Input_1.default, { value: newAdjustment.label, onChange: (e) => setNewAdjustment((s) => ({ ...s, label: e.target.value })) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Amount (KES)" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2 items-center", children: [(0, jsx_runtime_1.jsx)(Input_1.default, { type: "number", value: String(newAdjustment.amount), onChange: (e) => setNewAdjustment((s) => ({ ...s, amount: e.target.value === "" ? "" : Number(e.target.value) })) }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "primary", onClick: addAdjustment, children: "Add" })] })] })] }) })] })] })] })] })] }));
}
