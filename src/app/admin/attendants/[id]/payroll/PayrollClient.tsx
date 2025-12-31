"use client";

import React, { useEffect, useMemo, useState } from "react";
import Button from "@/app/_components/Button";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import { showToast } from "@/lib/ui/toast";

type CompPlan = {
  id?: string;
  attendantId: string;
  baseSalary: number;
  frequency: "MONTHLY" | "PERIOD";
  defaultChamaDeduction?: number | null;
  defaultOtherDeduction?: number | null;
  defaultTransportAllowance?: number | null;
  notes?: string | null;
};

type Adjustment = {
  id: string;
  adjustmentType: string;
  label: string;
  amount: number;
  adjustmentKind?: string | null;
  kind?: string | null;
};

export default function PayrollClient({
  attendant,
  initialPlan,
  periodKey,
  periodLabel,
  initialAdjustments,
  initialSummary,
  ledger,
  previousLedger,
}: {
  attendant: { id: string; name?: string | null; email?: string | null };
  initialPlan: CompPlan | null;
  periodKey: string;
  periodLabel: string;
  initialAdjustments: Adjustment[];
  initialSummary: any;
  ledger?: {
    commissionDirect?: number | null;
    commissionMarketplaceJumia?: number | null;
    commissionMarketplaceKilimall?: number | null;
    netCommission?: number | null;
    commissionBreakdown?: Record<string, number | undefined>;
  } | null;
  previousLedger?: { netCommission?: number | null } | null;
}) {
  const [plan, setPlan] = useState<CompPlan | null>(
    initialPlan
      ? { ...initialPlan }
      : {
          attendantId: attendant.id,
          baseSalary: 0,
          frequency: "PERIOD",
          defaultChamaDeduction: 0,
          defaultOtherDeduction: 0,
          defaultTransportAllowance: 0,
          notes: "",
        },
  );
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments || []);
  const [summary, setSummary] = useState<any>(initialSummary || null);
  const [saving, setSaving] = useState(false);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);

  const [newAdjustment, setNewAdjustment] = useState<{ adjustmentType: string; label: string; amount: number | ""; adjustmentKind?: "ADDITION" | "DEDUCTION" }>(
    { adjustmentType: "BONUS", label: "", amount: "", adjustmentKind: "ADDITION" }
  );
  const commissionValue =
    initialSummary?.commission ??
    initialSummary?.grossCommission ??
    initialSummary?.salesCommission ??
    initialSummary?._raw?.commission ??
    initialSummary?._raw?.grossCommission ??
    initialSummary?._raw?.salesCommission ??
    0;
  const periodProfit = Number(initialSummary?.totalProfit ?? initialSummary?._raw?.totalProfit ?? 0);
  const periodReceipts = Number(initialSummary?.totalReceipts ?? initialSummary?._raw?.totalReceipts ?? 0);
  const periodItems = Number(initialSummary?.totalItems ?? initialSummary?._raw?.totalItems ?? 0);
  const ledgerTotals = useMemo(() => {
    const breakdown = ledger?.commissionBreakdown ?? {};
    return {
      direct: Number(ledger?.commissionDirect ?? breakdown?.direct ?? 0),
      jumia: Number(ledger?.commissionMarketplaceJumia ?? breakdown?.jumia ?? breakdown?.["marketplace:jumia"] ?? 0),
      kilimall: Number(
        ledger?.commissionMarketplaceKilimall ?? breakdown?.kilimall ?? breakdown?.["marketplace:kilimall"] ?? 0,
      ),
      netCommission: Number(ledger?.netCommission ?? initialSummary?._raw?.netCommission ?? 0),
    };
  }, [ledger, initialSummary]);
  const previousNetCommission = Number(previousLedger?.netCommission ?? 0);
  const netCommissionDelta = ledgerTotals.netCommission - previousNetCommission;
  const adjustmentTotals = useMemo(() => {
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
      if (type === "CHAMA") totals.chama += amount;
      if (type === "LATENESS") totals.lateness += amount;
      if (type === "DISCIPLINE") totals.discipline += amount;
      if (type === "OTHER") totals.other += amount;
    }
    return totals;
  }, [adjustments]);

  useEffect(() => {
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
      if (!res.ok) throw new Error("Failed to load adjustments");
      const data = await res.json();
      setAdjustments(data.rows || []);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "Failed to load adjustments", "error");
    } finally {
      setLoadingAdjustments(false);
    }
  }

  async function fetchSummary() {
    try {
      const url = `/api/marketing/earnings/summary?attendantId=${encodeURIComponent(attendant.id)}`;
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.summary) setSummary(data.summary);
    } catch (err) {
      // ignore
    }
  }

  const savePlan = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/attendants/${attendant.id}/comp-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      showToast("Comp plan saved", "success");
      // refresh earnings summary after plan change
      fetchSummary();
    } catch (err: any) {
      showToast(err?.message || "Failed to save comp plan", "error");
    } finally {
      setSaving(false);
    }
  };

  const addAdjustment = async () => {
    if (!newAdjustment.label || !newAdjustment.adjustmentType || newAdjustment.amount === "") {
      showToast("Please fill type, label and amount", "error");
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
      showToast("Adjustment added", "success");
      setNewAdjustment({ adjustmentType: "BONUS", label: "", amount: "" });
      await fetchAdjustments();
      await fetchSummary();
    } catch (err: any) {
      showToast(err?.message || "Failed to add adjustment", "error");
    }
  };

  const deleteAdjustment = async (id: string) => {
    if (!confirm("Delete this adjustment?")) return;
    try {
      const url = `/api/admin/attendants/${attendant.id}/payroll-adjustments?adjustmentId=${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete");
      }
      showToast("Adjustment deleted", "success");
      await fetchAdjustments();
      await fetchSummary();
    } catch (err: any) {
      showToast(err?.message || "Failed to delete adjustment", "error");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{attendant.name ?? attendant.email}</h2>
            <p className="text-xs text-slate-400">Payroll settings</p>
          </div>
          <div>
            <Button variant="secondary" onClick={savePlan} disabled={saving}>
              Save
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-slate-400">Base salary (KES)</label>
            <Input type="number" value={String(plan?.baseSalary ?? 0)} onChange={(e) => setPlan(p => p ? {...p, baseSalary: Number(e.target.value || 0)} : p)} />
          </div>
          <div>
            <label className="text-xs text-slate-400">Transport allowance (KES)</label>
            <Input type="number" value={String(plan?.defaultTransportAllowance ?? 0)} onChange={(e) => setPlan(p => p ? {...p, defaultTransportAllowance: Number(e.target.value || 0)} : p)} />
          </div>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Current period — {periodLabel}</h2>
          </div>
        </div>

        <div className="mt-3 space-y-3 text-sm">
          <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex items-center justify-between">
            <span className="text-slate-300">Period sales</span>
            <span className="font-semibold text-emerald-400">KES {initialSummary?.sales?.toLocaleString?.() ?? 0}</span>
          </div>
          <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex items-center justify-between">
            <span className="text-slate-300">Commission</span>
            <span className="font-semibold text-emerald-400">
              KES {commissionValue.toLocaleString?.() ?? 0}
            </span>
          </div>
          <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex items-center justify-between">
            <span className="text-slate-300">Net pay</span>
            <span className="font-semibold text-emerald-400">KES {initialSummary?.netPay?.toLocaleString?.() ?? 0}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Profit</span>
              <span className="font-semibold text-slate-100">KES {periodProfit.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts</span>
              <span className="font-semibold text-slate-100">{periodReceipts.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Items</span>
              <span className="font-semibold text-slate-100">{periodItems.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Top-ups</span>
              <span className="font-semibold text-slate-100">KES {adjustmentTotals.topUps.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Deductions</span>
              <span className="font-semibold text-slate-100">KES {adjustmentTotals.deductions.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Lateness</span>
              <span className="font-semibold text-slate-100">KES {adjustmentTotals.lateness.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Chama</span>
              <span className="font-semibold text-slate-100">KES {adjustmentTotals.chama.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Discipline</span>
              <span className="font-semibold text-slate-100">KES {adjustmentTotals.discipline.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Other</span>
              <span className="font-semibold text-slate-100">KES {adjustmentTotals.other.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Direct commission</span>
              <span className="font-semibold text-slate-100">KES {ledgerTotals.direct.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Marketplace</span>
              <span className="font-semibold text-slate-100">Jumia KES {ledgerTotals.jumia.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Marketplace</span>
              <span className="font-semibold text-slate-100">Kilimall KES {ledgerTotals.kilimall.toLocaleString()}</span>
            </div>
            <div className="rounded-xl bg-slate-950/60 px-3 py-2 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Net commission vs prev</span>
              <span className={`font-semibold ${netCommissionDelta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {netCommissionDelta >= 0 ? "+" : "-"}KES {Math.abs(netCommissionDelta).toLocaleString()}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-200">Adjustments</h3>
            <div className="mt-2 space-y-2">
              {adjustments.map((a) => {
                const kind = (a.adjustmentKind || a.kind || "DEDUCTION").toUpperCase();
                const isAddition = kind === "ADDITION";
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">{a.label}</div>
                        <div
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isAddition ? "bg-emerald-700 text-emerald-100" : "bg-rose-800 text-rose-100"
                          }`}
                        >
                          {isAddition ? "Addition" : "Deduction"}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400">{a.adjustmentType}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-sm font-semibold ${isAddition ? "text-emerald-300" : "text-rose-300"}`}>
                        {isAddition ? "KES " : "KES -"}{Math.abs(Number(a.amount || 0)).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAdjustment(a.id)}
                        className="text-xs rounded-full border border-red-600 px-2 py-1 text-rose-400 hover:bg-red-800/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {adjustments.length === 0 && <div className="text-xs text-slate-400">No adjustments for this period.</div>}

              <div className="mt-3 rounded-xl border border-white/5 bg-slate-900/50 p-3">
                <div className="grid gap-2 md:grid-cols-3 items-end">
                  <div>
                    <label className="text-xs text-slate-400">Type</label>
                    <select
                      value={newAdjustment.adjustmentType}
                      onChange={(e) => {
                        const t = e.target.value;
                        // default kind: bonuses and top-ups are additions, others are deductions
                        const kind = t === "BONUS" || t === "COMMISSION_TOPUP" ? "ADDITION" : "DEDUCTION";
                        setNewAdjustment((s) => ({ ...s, adjustmentType: t, adjustmentKind: kind }));
                      }}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100"
                    >
                      <option value="CHAMA">Chama</option>
                      <option value="LATENESS">Lateness</option>
                      <option value="DISCIPLINE">Disciplinary</option>
                      <option value="BONUS">Bonus</option>
                      <option value="COMMISSION_TOPUP">Commission top-up</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Kind</label>
                    <select
                      value={newAdjustment.adjustmentKind}
                      onChange={(e) => setNewAdjustment((s) => ({ ...s, adjustmentKind: (e.target.value as any) }))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100"
                    >
                      <option value="ADDITION">Addition</option>
                      <option value="DEDUCTION">Deduction</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Label</label>
                    <Input value={newAdjustment.label} onChange={(e) => setNewAdjustment((s) => ({ ...s, label: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Amount (KES)</label>
                    <div className="flex gap-2 items-center">
                      <Input type="number" value={String(newAdjustment.amount)} onChange={(e) => setNewAdjustment((s) => ({ ...s, amount: e.target.value === "" ? "" : Number(e.target.value) }))} />
                      <Button variant="primary" onClick={addAdjustment}>Add</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
