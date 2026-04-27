"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/app/_components/Button";
import { toast } from "@/lib/toast";
import { MAX_CASH_ADVANCE_REPAYMENT_PERIOD } from "@/lib/wellnessPolicy";

type LeaveRequest = {
  id: string;
  type: string;
  status: string;
  daysRequested: number;
  startDate: string;
  endDate: string;
  reason: string;
  managerComment?: string | null;
  user: { id: string; name?: string | null; email: string; attendantCategory?: string | null };
};

type CashAdvance = {
  id: string;
  requestedAmount: number;
  approvedAmount?: number | null;
  status: string;
  reason: string;
  repaymentPeriod?: number | null;
  remainingBalance: number;
  user: { id: string; name?: string | null; email: string; attendantCategory?: string | null };
  installments?: Array<{ id: string; dueDate: string; amount: number; isPaid: boolean }>;
};

type LeaveBalance = {
  id: string;
  annualEntitlement: number;
  sickEntitlement: number;
  emergencyEntitlement: number;
  annualUsed: number;
  sickUsed: number;
  emergencyUsed: number;
  user: { id: string; name?: string | null; email: string; attendantCategory?: string | null };
};

type SummaryResponse = {
  pendingLeaveRequests: LeaveRequest[];
  pendingCashAdvances: CashAdvance[];
  outstandingAdvances: CashAdvance[];
  leaveBalances: LeaveBalance[];
  totals: {
    pendingLeaveCount: number;
    pendingCashAdvanceCount: number;
    outstandingAdvanceBalance: number;
  };
};

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default function AdminWellnessClient() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [leaveComments, setLeaveComments] = useState<Record<string, string>>({});
  const [advanceForms, setAdvanceForms] = useState<Record<string, { approvedAmount: string; repaymentPeriod: string; hrComment: string }>>({});
  const [balanceDrafts, setBalanceDrafts] = useState<Record<string, { annualEntitlement: string; sickEntitlement: string; emergencyEntitlement: string }>>({});

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/wellness/summary", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to load wellness summary"));
      setData(body);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to load wellness summary", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, []);

  useEffect(() => {
    if (!data) return;
    const nextAdvanceForms: Record<string, { approvedAmount: string; repaymentPeriod: string; hrComment: string }> = {};
    for (const row of data.pendingCashAdvances) {
      nextAdvanceForms[row.id] = {
        approvedAmount: String(row.requestedAmount ?? ""),
        repaymentPeriod: String(row.repaymentPeriod ?? MAX_CASH_ADVANCE_REPAYMENT_PERIOD),
        hrComment: "",
      };
    }
    setAdvanceForms(nextAdvanceForms);

    const nextBalanceDrafts: Record<string, { annualEntitlement: string; sickEntitlement: string; emergencyEntitlement: string }> = {};
    for (const balance of data.leaveBalances) {
      nextBalanceDrafts[balance.user.id] = {
        annualEntitlement: String(balance.annualEntitlement),
        sickEntitlement: String(balance.sickEntitlement),
        emergencyEntitlement: String(balance.emergencyEntitlement),
      };
    }
    setBalanceDrafts(nextBalanceDrafts);
  }, [data]);

  const totals = useMemo(
    () => data?.totals ?? { pendingLeaveCount: 0, pendingCashAdvanceCount: 0, outstandingAdvanceBalance: 0 },
    [data],
  );

  const decideLeave = async (id: string, decision: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/leave/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, managerComment: leaveComments[id] ?? "" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to update leave request"));
      toast(`Leave request ${decision.toLowerCase()}`, "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to update leave request", "error");
    }
  };

  const decideAdvance = async (id: string, decision: "APPROVED" | "REJECTED") => {
    try {
      const form = advanceForms[id];
      const res = await fetch(`/api/cash-advance/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          approvedAmount: Number(form?.approvedAmount ?? 0),
          repaymentPeriod: Number(form?.repaymentPeriod ?? 0),
          hrComment: form?.hrComment ?? "",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to update cash advance"));
      toast(`Cash advance ${decision.toLowerCase()}`, "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to update cash advance", "error");
    }
  };

  const saveBalance = async (userId: string) => {
    try {
      const draft = balanceDrafts[userId];
      const res = await fetch(`/api/admin/wellness/leave-balances/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualEntitlement: Number(draft?.annualEntitlement ?? 0),
          sickEntitlement: Number(draft?.sickEntitlement ?? 0),
          emergencyEntitlement: Number(draft?.emergencyEntitlement ?? 0),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to save leave balance"));
      toast("Leave balance updated", "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to save leave balance", "error");
    }
  };

  const processDueInstallments = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/wellness/cash-advances/process-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to process due installments"));
      toast(`Processed ${body.processedCount ?? 0} installment(s)`, "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to process due installments", "error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,.18),transparent_28%),linear-gradient(135deg,#111827,#0f172a_60%,#0b1220)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">Admin Wellness</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Review staff wellness requests and keep payroll deductions aligned.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Staff have a shared 10-day annual leave allowance per year. Sick, emergency, and other leave requests draw from the same yearly balance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Stat label="Pending leave" value={String(totals.pendingLeaveCount)} />
            <Stat label="Pending advances" value={String(totals.pendingCashAdvanceCount)} />
            <Stat label="Outstanding balance" value={currency.format(totals.outstandingAdvanceBalance)} />
            <Button onClick={() => void processDueInstallments()} disabled={processing || loading}>
              {processing ? "Processing..." : "Run due deductions"}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Pending Leave Requests</h2>
          <div className="mt-4 space-y-4">
            {(data?.pendingLeaveRequests ?? []).map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-medium text-slate-100">{row.user.name || row.user.email}</div>
                    <div className="text-xs text-slate-400">
                      {row.user.attendantCategory ?? "No category"} · {row.type} · {row.daysRequested} day(s)
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {dateFmt.format(new Date(row.startDate))} - {dateFmt.format(new Date(row.endDate))}
                    </div>
                  </div>
                  <div className="max-w-md text-sm text-slate-300">{row.reason}</div>
                </div>
                <textarea
                  className="mt-4 min-h-20 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                  placeholder="Manager comment"
                  value={leaveComments[row.id] ?? ""}
                  onChange={(e) => setLeaveComments((state) => ({ ...state, [row.id]: e.target.value }))}
                />
                <div className="mt-3 flex gap-3">
                  <Button onClick={() => void decideLeave(row.id, "APPROVED")}>Approve</Button>
                  <Button variant="secondary" onClick={() => void decideLeave(row.id, "REJECTED")}>Reject</Button>
                </div>
              </div>
            ))}
            {!data?.pendingLeaveRequests?.length && !loading ? <EmptyCard label="No pending leave requests." /> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Pending Cash Advances</h2>
          <div className="mt-4 space-y-4">
            {(data?.pendingCashAdvances ?? []).map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-medium text-slate-100">{row.user.name || row.user.email}</div>
                    <div className="text-xs text-slate-400">{row.user.attendantCategory ?? "No category"}</div>
                  </div>
                  <div className="text-sm text-slate-300">{row.reason}</div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field
                    label="Requested"
                    value={advanceForms[row.id]?.approvedAmount ?? String(row.requestedAmount)}
                    onChange={(value) =>
                      setAdvanceForms((state) => ({
                        ...state,
                        [row.id]: { ...state[row.id], approvedAmount: value },
                      }))
                    }
                  />
                  <Field
                    label="Months"
                    value={advanceForms[row.id]?.repaymentPeriod ?? String(MAX_CASH_ADVANCE_REPAYMENT_PERIOD)}
                    onChange={(value) =>
                      setAdvanceForms((state) => ({
                        ...state,
                        [row.id]: { ...state[row.id], repaymentPeriod: value },
                      }))
                    }
                  />
                  <Field
                    label="Comment"
                    value={advanceForms[row.id]?.hrComment ?? ""}
                    onChange={(value) =>
                      setAdvanceForms((state) => ({
                        ...state,
                        [row.id]: { ...state[row.id], hrComment: value },
                      }))
                    }
                  />
                </div>
                <div className="mt-3 flex gap-3">
                  <Button onClick={() => void decideAdvance(row.id, "APPROVED")}>Approve</Button>
                  <Button variant="secondary" onClick={() => void decideAdvance(row.id, "REJECTED")}>Reject</Button>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Maximum repayment period is {MAX_CASH_ADVANCE_REPAYMENT_PERIOD} month(s).
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Approval deducts the first installment immediately and schedules the next one for the next trading period.
                </div>
              </div>
            ))}
            {!data?.pendingCashAdvances?.length && !loading ? <EmptyCard label="No pending cash advances." /> : null}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Leave Balances</h2>
          <div className="mt-4 space-y-4">
            {(data?.leaveBalances ?? []).map((balance) => (
              <div key={balance.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <div className="mb-3">
                  <div className="font-medium text-slate-100">{balance.user.name || balance.user.email}</div>
                  <div className="text-xs text-slate-400">{balance.user.attendantCategory ?? "No category"}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field
                    label="Annual"
                    value={balanceDrafts[balance.user.id]?.annualEntitlement ?? String(balance.annualEntitlement)}
                    onChange={(value) =>
                      setBalanceDrafts((state) => ({
                        ...state,
                        [balance.user.id]: { ...state[balance.user.id], annualEntitlement: value },
                      }))
                    }
                  />
                  <Field
                    label="Sick"
                    value={balanceDrafts[balance.user.id]?.sickEntitlement ?? String(balance.sickEntitlement)}
                    onChange={(value) =>
                      setBalanceDrafts((state) => ({
                        ...state,
                        [balance.user.id]: { ...state[balance.user.id], sickEntitlement: value },
                      }))
                    }
                  />
                  <Field
                    label="Emergency"
                    value={balanceDrafts[balance.user.id]?.emergencyEntitlement ?? String(balance.emergencyEntitlement)}
                    onChange={(value) =>
                      setBalanceDrafts((state) => ({
                        ...state,
                        [balance.user.id]: { ...state[balance.user.id], emergencyEntitlement: value },
                      }))
                    }
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Used: A {balance.annualUsed} · S {balance.sickUsed} · E {balance.emergencyUsed}
                  </span>
                  <Button variant="secondary" onClick={() => void saveBalance(balance.user.id)}>Save balance</Button>
                </div>
              </div>
            ))}
            {!data?.leaveBalances?.length && !loading ? <EmptyCard label="No leave balances found." /> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Outstanding Advances</h2>
          <div className="mt-4 space-y-4">
            {(data?.outstandingAdvances ?? []).map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{row.user.name || row.user.email}</div>
                    <div className="text-xs text-slate-400">
                      Approved {currency.format(row.approvedAmount ?? 0)} · Remaining {currency.format(row.remainingBalance)}
                    </div>
                  </div>
                    <div className="text-xs text-slate-400">{row.repaymentPeriod ?? 0} month(s)</div>
                </div>
                <div className="mt-3 space-y-2">
                  {(row.installments ?? []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                      <span className="text-slate-300">{dateFmt.format(new Date(item.dueDate))}</span>
                      <span className={item.isPaid ? "text-emerald-200" : "text-rose-200"}>
                        {item.isPaid ? "Paid" : currency.format(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!data?.outstandingAdvances?.length && !loading ? <EmptyCard label="No outstanding advances." /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <input
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function EmptyCard({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">{label}</div>;
}
