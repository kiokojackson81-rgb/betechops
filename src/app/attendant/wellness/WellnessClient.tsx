"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/app/_components/Button";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import { toast } from "@/lib/toast";

type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  daysRequested: number;
  reason: string;
  supportingDocumentUrl?: string | null;
  managerComment?: string | null;
  createdAt: string;
};

type CashAdvanceRow = {
  id: string;
  requestedAmount: number;
  approvedAmount?: number | null;
  status: string;
  reason: string;
  repaymentPeriod?: number | null;
  installmentAmount?: number | null;
  remainingBalance: number;
  hrComment?: string | null;
  installments: Array<{
    id: string;
    dueDate: string;
    periodLabel: string;
    sequenceNumber: number;
    amount: number;
    isPaid: boolean;
  }>;
  createdAt: string;
};

type OverviewResponse = {
  leaveBalance: {
    annual: { entitlement: number; used: number; remaining: number };
    sick: { entitlement: number; used: number; remaining: number };
    emergency: { entitlement: number; used: number; remaining: number };
    totalRemaining: number;
  };
  leaveRequests: LeaveRow[];
  cashAdvances: CashAdvanceRow[];
  upcomingInstallments: Array<{
    id: string;
    dueDate: string;
    periodLabel: string;
    sequenceNumber: number;
    amount: number;
    cashAdvance: { id: string; approvedAmount?: number | null; remainingBalance: number };
  }>;
  outstandingAdvanceBalance: number;
  payroll: {
    periodLabel: string;
    attendantCategory?: string | null;
    baseSalary: number;
    transportAllowance: number;
    commissionDirect: number;
    commissionMarketplaceJumia: number;
    commissionMarketplaceKilimall: number;
    commissionTotal: number;
    bonusTotal: number;
    commissionTopUpTotal: number;
    chamaTotal: number;
    latenessTotal: number;
    disciplineTotal: number;
    otherDeductionsTotal: number;
    cashAdvanceTotal: number;
    totalEarnings: number;
    totalDeductions: number;
    netPay: number;
    totalSales: number;
    totalProfit: number;
    adjustmentEntries: Array<{
      id: string;
      label: string;
      amount: number;
      adjustmentType: string;
      kind?: string;
      adjustmentKind?: string;
    }>;
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

const statusClass: Record<string, string> = {
  APPROVED: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  REJECTED: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  PENDING: "bg-amber-500/15 text-amber-100 border-amber-300/30",
};

const leaveTypes = ["ANNUAL", "SICK", "EMERGENCY", "UNPAID", "OTHER"];

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function requestWellnessOverview(impersonateId: string | null) {
  const params = new URLSearchParams();
  if (impersonateId) params.set("impersonateId", impersonateId);
  const res = await fetch(`/api/wellness-overview${params.toString() ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(String(body?.error ?? "Failed to load wellness overview"));
  return body as OverviewResponse;
}

export default function WellnessClient() {
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonateId");

  const [loading, setLoading] = useState(true);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [submittingAdvance, setSubmittingAdvance] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    type: "ANNUAL",
    startDate: toDateInput(new Date()),
    endDate: toDateInput(new Date()),
    reason: "",
    supportingDocumentUrl: "",
  });
  const [advanceForm, setAdvanceForm] = useState({
    requestedAmount: "",
    repaymentPeriod: "3",
    reason: "",
  });

  const fetchOverview = async () => {
    setLoading(true);
    try {
      setOverview(await requestWellnessOverview(impersonateId));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to load wellness overview", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setOverview(await requestWellnessOverview(impersonateId));
      } catch (error) {
        toast(error instanceof Error ? error.message : "Failed to load wellness overview", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [impersonateId]);

  const payrollBreakdown = useMemo(() => {
    if (!overview?.payroll) return null;
    return buildEarningsCardBreakdown({
      attendantCategory: overview.payroll.attendantCategory,
      baseSalary: overview.payroll.baseSalary,
      transportAllowance: overview.payroll.transportAllowance,
      commissionDirect: overview.payroll.commissionDirect,
      commissionMarketplaceJumia: overview.payroll.commissionMarketplaceJumia,
      commissionMarketplaceKilimall: overview.payroll.commissionMarketplaceKilimall,
      commissionTotal: overview.payroll.commissionTotal,
      bonusTotal: overview.payroll.bonusTotal,
      commissionTopUpTotal: overview.payroll.commissionTopUpTotal,
      chamaTotal: overview.payroll.chamaTotal,
      latenessTotal: overview.payroll.latenessTotal,
      disciplineTotal: overview.payroll.disciplineTotal,
      otherDeductionsTotal: overview.payroll.otherDeductionsTotal,
      cashAdvanceTotal: overview.payroll.cashAdvanceTotal,
      totalEarnings: overview.payroll.totalEarnings,
      totalDeductions: overview.payroll.totalDeductions,
      netPay: overview.payroll.netPay,
      adjustmentEntries: overview.payroll.adjustmentEntries,
    });
  }, [overview?.payroll]);

  const submitLeave = async () => {
    setSubmittingLeave(true);
    try {
      const params = new URLSearchParams();
      if (impersonateId) params.set("impersonateId", impersonateId);
      const res = await fetch(`/api/leave${params.toString() ? `?${params.toString()}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveForm),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to submit leave request"));
      toast("Leave request submitted", "success");
      setLeaveForm((state) => ({ ...state, reason: "", supportingDocumentUrl: "" }));
      await fetchOverview();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to submit leave request", "error");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const submitCashAdvance = async () => {
    setSubmittingAdvance(true);
    try {
      const params = new URLSearchParams();
      if (impersonateId) params.set("impersonateId", impersonateId);
      const res = await fetch(`/api/cash-advance${params.toString() ? `?${params.toString()}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedAmount: Number(advanceForm.requestedAmount),
          repaymentPeriod: Number(advanceForm.repaymentPeriod),
          reason: advanceForm.reason,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to submit cash advance"));
      toast("Cash advance request submitted", "success");
      setAdvanceForm({ requestedAmount: "", repaymentPeriod: "3", reason: "" });
      await fetchOverview();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to submit cash advance", "error");
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const uploadSupportingFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", "leave-supporting-docs");
      const res = await fetch("/api/wellness/upload", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to upload file"));
      setLeaveForm((state) => ({ ...state, supportingDocumentUrl: String(body.url ?? "") }));
      toast("Supporting document uploaded", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to upload file", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-shell py-6 text-slate-100">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,.16),transparent_28%),linear-gradient(135deg,#111827,#0f172a_55%,#1f2937)] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-200/80">Wellness Center</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Leave, salary advances, and deduction transparency in one place.</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Request time off, apply for cash support, and keep an eye on repayments against your current payroll window.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Leave left" value={String(overview?.leaveBalance.totalRemaining ?? "-")} />
              <MetricCard label="Outstanding advance" value={currency.format(overview?.outstandingAdvanceBalance ?? 0)} />
              <MetricCard label="Net pay" value={currency.format(overview?.payroll.netPay ?? 0)} />
              <MetricCard label="Deductions" value={currency.format(overview?.payroll.totalDeductions ?? 0)} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Submit Leave</h2>
                  <p className="text-sm text-slate-400">Annual, sick, emergency, or unpaid leave requests with optional evidence upload.</p>
                </div>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                  {overview?.leaveBalance.totalRemaining ?? 0} day(s) left
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Leave type</span>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm((state) => ({ ...state, type: e.target.value }))}
                  >
                    {leaveTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Supporting document URL</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                    value={leaveForm.supportingDocumentUrl}
                    onChange={(e) => setLeaveForm((state) => ({ ...state, supportingDocumentUrl: e.target.value }))}
                    placeholder="Optional file link"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Start date</span>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm((state) => ({ ...state, startDate: e.target.value }))}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">End date</span>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm((state) => ({ ...state, endDate: e.target.value }))}
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2 text-sm">
                <span className="text-slate-300">Reason</span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((state) => ({ ...state, reason: e.target.value }))}
                  placeholder="Explain why you need the leave"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => void uploadSupportingFile(e.target.files?.[0] ?? null)}
                  />
                  {uploading ? "Uploading..." : "Upload file"}
                </label>
                {leaveForm.supportingDocumentUrl ? (
                  <a className="text-sm text-amber-200 underline" href={leaveForm.supportingDocumentUrl} target="_blank" rel="noreferrer">
                    View attached document
                  </a>
                ) : null}
                <Button onClick={() => void submitLeave()} disabled={submittingLeave || loading}>
                  {submittingLeave ? "Submitting..." : "Submit leave"}
                </Button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Request Cash Advance</h2>
                <p className="text-sm text-slate-400">Ask for an advance and propose how many payroll cycles you want for repayment.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Requested amount</span>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                    value={advanceForm.requestedAmount}
                    onChange={(e) => setAdvanceForm((state) => ({ ...state, requestedAmount: e.target.value }))}
                    placeholder="KES"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Repayment cycles</span>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                    value={advanceForm.repaymentPeriod}
                    onChange={(e) => setAdvanceForm((state) => ({ ...state, repaymentPeriod: e.target.value }))}
                  />
                </label>
              </div>
              <label className="mt-4 block space-y-2 text-sm">
                <span className="text-slate-300">Reason</span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none"
                  value={advanceForm.reason}
                  onChange={(e) => setAdvanceForm((state) => ({ ...state, reason: e.target.value }))}
                  placeholder="Why do you need the advance?"
                />
              </label>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void submitCashAdvance()} disabled={submittingAdvance || loading}>
                  {submittingAdvance ? "Submitting..." : "Submit cash advance"}
                </Button>
              </div>
            </section>

            <HistorySection
              leaveRequests={overview?.leaveRequests ?? []}
              cashAdvances={overview?.cashAdvances ?? []}
              loading={loading}
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Leave Balances</h2>
              <div className="mt-4 grid gap-3">
                <BalanceRow label="Annual" data={overview?.leaveBalance.annual} />
                <BalanceRow label="Sick" data={overview?.leaveBalance.sick} />
                <BalanceRow label="Emergency" data={overview?.leaveBalance.emergency} />
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Payroll Snapshot</h2>
                  <p className="text-sm text-slate-400">{overview?.payroll.periodLabel ?? "Current period"}</p>
                </div>
                <span className="text-sm text-emerald-300">{currency.format(overview?.payroll.netPay ?? 0)}</span>
              </div>
              <div className="mt-4 space-y-3">
                {(payrollBreakdown?.lines ?? []).map((line) => (
                  <div key={`${line.label}-${line.kind}`} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm">
                    <span className="text-slate-300">{line.label}</span>
                    <span className={line.kind === "deduction" ? "text-rose-200" : "text-emerald-200"}>
                      {line.kind === "deduction" ? "-" : "+"}
                      {currency.format(line.amount)}
                    </span>
                  </div>
                ))}
                {!payrollBreakdown?.lines?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">No payroll breakdown yet.</div>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Upcoming Repayments</h2>
                <span className="text-sm text-slate-400">{currency.format(overview?.outstandingAdvanceBalance ?? 0)} outstanding</span>
              </div>
              <div className="mt-4 space-y-3">
                {(overview?.upcomingInstallments ?? []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-100">Installment {item.sequenceNumber}</div>
                        <div className="text-xs text-slate-400">{dateFmt.format(new Date(item.dueDate))} · {item.periodLabel}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-rose-200">{currency.format(item.amount)}</div>
                        <div className="text-xs text-slate-400">Balance {currency.format(item.cashAdvance.remainingBalance)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {!overview?.upcomingInstallments?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                    No upcoming deductions scheduled.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function BalanceRow({
  label,
  data,
}: {
  label: string;
  data?: { entitlement: number; used: number; remaining: number };
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-100">{label}</div>
          <div className="text-xs text-slate-400">
            Used {data?.used ?? 0} of {data?.entitlement ?? 0}
          </div>
        </div>
        <div className="text-lg font-semibold text-amber-200">{data?.remaining ?? 0}</div>
      </div>
    </div>
  );
}

function HistorySection({
  leaveRequests,
  cashAdvances,
  loading,
}: {
  leaveRequests: LeaveRow[];
  cashAdvances: CashAdvanceRow[];
  loading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Leave Requests</h2>
          <div className="mt-4 space-y-3">
            {leaveRequests.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{row.type.replaceAll("_", " ")} leave</div>
                    <div className="text-xs text-slate-400">
                      {dateFmt.format(new Date(row.startDate))} - {dateFmt.format(new Date(row.endDate))} · {row.daysRequested} day(s)
                    </div>
                  </div>
                  <StatusBadge value={row.status} />
                </div>
                <p className="mt-3 text-sm text-slate-300">{row.reason}</p>
                {row.managerComment ? <p className="mt-2 text-xs text-amber-200">Manager: {row.managerComment}</p> : null}
              </div>
            ))}
            {!leaveRequests.length && !loading ? <EmptyCard label="No leave requests yet." /> : null}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Cash Advances</h2>
          <div className="mt-4 space-y-3">
            {cashAdvances.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{currency.format(row.requestedAmount)} requested</div>
                    <div className="text-xs text-slate-400">{dateFmt.format(new Date(row.createdAt))}</div>
                  </div>
                  <StatusBadge value={row.status} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                  <div>Approved: {currency.format(row.approvedAmount ?? 0)}</div>
                  <div>Remaining: {currency.format(row.remainingBalance ?? 0)}</div>
                  <div>Cycles: {row.repaymentPeriod ?? "-"}</div>
                  {row.hrComment ? <div className="text-amber-200">HR: {row.hrComment}</div> : null}
                </div>
              </div>
            ))}
            {!cashAdvances.length && !loading ? <EmptyCard label="No cash advances yet." /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass[value] ?? statusClass.PENDING}`}>
      {value}
    </span>
  );
}

function EmptyCard({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">{label}</div>;
}
