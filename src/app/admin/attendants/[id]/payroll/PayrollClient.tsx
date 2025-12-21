"use client";

import React, { useEffect, useState } from "react";
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
};

export default function PayrollClient({
  attendant,
  initialPlan,
  periodKey,
  periodLabel,
  initialAdjustments,
  initialSummary,
}: {
  attendant: { id: string; name?: string | null; email?: string | null };
  initialPlan: CompPlan | null;
  periodKey: string;
  periodLabel: string;
  initialAdjustments: Adjustment[];
  initialSummary: any;
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

  const [newAdjustment, setNewAdjustment] = useState<{ adjustmentType: string; label: string; amount: number | "" }>(
    { adjustmentType: "BONUS", label: "", amount: "" }
  );

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
            <span className="text-slate-300">Net pay</span>
            <span className="font-semibold text-emerald-400">KES {initialSummary?.netPay?.toLocaleString?.() ?? 0}</span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-200">Adjustments</h3>
            <div className="mt-2 space-y-2">
              {adjustments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
                  <div>
                    <div className="text-sm">{a.label}</div>
                    <div className="text-xs text-slate-400">{a.adjustmentType}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-100">KES {a.amount.toLocaleString()}</div>
                    <button
                      type="button"
                      onClick={() => deleteAdjustment(a.id)}
                      className="text-xs rounded-full border border-red-600 px-2 py-1 text-rose-400 hover:bg-red-800/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {adjustments.length === 0 && <div className="text-xs text-slate-400">No adjustments for this period.</div>}

              <div className="mt-3 rounded-xl border border-white/5 bg-slate-900/50 p-3">
                <div className="grid gap-2 md:grid-cols-3 items-end">
                  <div>
                    <label className="text-xs text-slate-400">Type</label>
                    <select
                      value={newAdjustment.adjustmentType}
                      onChange={(e) => setNewAdjustment((s) => ({ ...s, adjustmentType: e.target.value }))}
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
