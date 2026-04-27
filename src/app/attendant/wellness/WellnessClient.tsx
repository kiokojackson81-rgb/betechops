"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/app/_components/Button";
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
  user?: {
    id: string;
    name?: string | null;
    email: string;
    attendantCategory?: string | null;
  };
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
const inputClass =
  "w-full rounded-2xl border border-slate-700 bg-slate-950/85 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/15 [color-scheme:dark]";
const surfaceClass = "rounded-[28px] border border-slate-800/90 bg-slate-900/80 p-6 shadow-[0_20px_60px_rgba(2,6,23,.35)]";
const sectionEyebrow = "text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400";

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
    void fetchOverview();
  }, [impersonateId]);

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
    <div className="page-shell relative overflow-hidden py-6 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,.12),transparent_26%),radial-gradient(circle_at_100%_20%,rgba(59,130,246,.12),transparent_24%),linear-gradient(180deg,#020617,#0f172a_38%,#111827_100%)]" />
      <div className="space-y-6">
        <section className="rounded-[32px] border border-slate-800/90 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,.16),transparent_22%),linear-gradient(135deg,#0f172a,#111827_58%,#172033)] px-7 py-7 shadow-[0_24px_80px_rgba(2,6,23,.45)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.4em] text-amber-200/90">Wellness Center</p>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Leave requests and cash support without touching payroll screens.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Submit leave, request a cash advance, upload supporting files, and track upcoming deductions from one place.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Leave left" value={String(overview?.leaveBalance.totalRemaining ?? "-")} />
              <MetricCard label="Outstanding" value={currency.format(overview?.outstandingAdvanceBalance ?? 0)} />
              <MetricCard label="Open leave" value={String(overview?.leaveRequests.length ?? 0)} />
              <MetricCard label="Upcoming due" value={String(overview?.upcomingInstallments.length ?? 0)} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,.82fr)]">
          <div className="space-y-6">
            <section className={surfaceClass}>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className={sectionEyebrow}>Leave Request</p>
                  <h2 className="text-2xl font-semibold text-white">Submit Leave</h2>
                  <p className="max-w-2xl text-sm leading-6 text-slate-400">
                    Annual, sick, emergency, or unpaid leave requests with optional evidence upload.
                  </p>
                </div>
                <span className="inline-flex h-fit rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
                  {overview?.leaveBalance.totalRemaining ?? 0} day(s) left
                </span>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <MiniInfoCard label="Annual" value={String(overview?.leaveBalance.annual.remaining ?? 0)} />
                <MiniInfoCard label="Sick" value={String(overview?.leaveBalance.sick.remaining ?? 0)} />
                <MiniInfoCard label="Emergency" value={String(overview?.leaveBalance.emergency.remaining ?? 0)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Leave type</span>
                  <select
                    className={inputClass}
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
                  <span className="font-medium text-slate-300">Supporting document URL</span>
                  <input
                    className={inputClass}
                    value={leaveForm.supportingDocumentUrl}
                    onChange={(e) => setLeaveForm((state) => ({ ...state, supportingDocumentUrl: e.target.value }))}
                    placeholder="Optional file link"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Start date</span>
                  <input
                    type="date"
                    className={inputClass}
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm((state) => ({ ...state, startDate: e.target.value }))}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-300">End date</span>
                  <input
                    type="date"
                    className={inputClass}
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm((state) => ({ ...state, endDate: e.target.value }))}
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2 text-sm">
                <span className="font-medium text-slate-300">Reason</span>
                <textarea
                  className={`${inputClass} min-h-32 resize-y`}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((state) => ({ ...state, reason: e.target.value }))}
                  placeholder="Explain why you need the leave"
                />
              </label>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/65 px-4 py-2.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900">
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
                <Button
                  onClick={() => void submitLeave()}
                  disabled={submittingLeave || loading}
                  className="min-w-[160px] w-full border border-amber-200/80 bg-amber-300 text-slate-950 shadow-[0_12px_30px_rgba(252,211,77,.22)] hover:bg-amber-200 sm:w-auto"
                >
                  {submittingLeave ? "Submitting..." : "Submit leave"}
                </Button>
              </div>
            </section>

            <section className={surfaceClass}>
              <div className="mb-6 space-y-2">
                <p className={sectionEyebrow}>Cash Advance</p>
                <h2 className="text-2xl font-semibold text-white">Request Cash Advance</h2>
                <p className="text-sm leading-6 text-slate-400">
                  Ask for an advance and propose how many payroll cycles you want for repayment.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Requested amount</span>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={advanceForm.requestedAmount}
                    onChange={(e) => setAdvanceForm((state) => ({ ...state, requestedAmount: e.target.value }))}
                    placeholder="KES"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Repayment cycles</span>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={advanceForm.repaymentPeriod}
                    onChange={(e) => setAdvanceForm((state) => ({ ...state, repaymentPeriod: e.target.value }))}
                  />
                </label>
              </div>
              <label className="mt-4 block space-y-2 text-sm">
                <span className="font-medium text-slate-300">Reason</span>
                <textarea
                  className={`${inputClass} min-h-32 resize-y`}
                  value={advanceForm.reason}
                  onChange={(e) => setAdvanceForm((state) => ({ ...state, reason: e.target.value }))}
                  placeholder="Why do you need the advance?"
                />
              </label>
              <div className="mt-5 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/55 p-4 sm:grid-cols-3">
                <MiniInfoCard label="Outstanding" value={currency.format(overview?.outstandingAdvanceBalance ?? 0)} />
                <MiniInfoCard label="Upcoming due" value={String(overview?.upcomingInstallments.length ?? 0)} />
                <MiniInfoCard label="Requests made" value={String(overview?.cashAdvances.length ?? 0)} />
              </div>
              <div className="mt-5 flex justify-end">
                <Button
                  onClick={() => void submitCashAdvance()}
                  disabled={submittingAdvance || loading}
                  className="min-w-[200px] w-full border border-amber-200/80 bg-amber-300 text-slate-950 shadow-[0_12px_30px_rgba(252,211,77,.22)] hover:bg-amber-200 sm:w-auto"
                >
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
            <section className={surfaceClass}>
              <p className={sectionEyebrow}>Balances</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Leave Balances</h2>
              <div className="mt-4 grid gap-3">
                <BalanceRow label="Annual" data={overview?.leaveBalance.annual} />
                <BalanceRow label="Sick" data={overview?.leaveBalance.sick} />
                <BalanceRow label="Emergency" data={overview?.leaveBalance.emergency} />
              </div>
            </section>

            <section className={surfaceClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={sectionEyebrow}>Repayments</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Upcoming Repayments</h2>
                </div>
                <span className="text-sm text-slate-400">{currency.format(overview?.outstandingAdvanceBalance ?? 0)} outstanding</span>
              </div>
              <div className="mt-4 space-y-3">
                {(overview?.upcomingInstallments ?? []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
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
                  <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
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
    <div className="min-w-[170px] rounded-[24px] border border-white/10 bg-slate-950/45 px-5 py-4 shadow-inner shadow-black/20">
      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-100">{value}</div>
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
  const entitlement = Math.max(0, data?.entitlement ?? 0);
  const used = Math.max(0, data?.used ?? 0);
  const remaining = Math.max(0, data?.remaining ?? 0);
  const progress = entitlement > 0 ? Math.min((used / entitlement) * 100, 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium text-slate-100">{label}</div>
          <div className="mt-1 text-xs text-slate-400">
            Used {used} of {entitlement}
          </div>
        </div>
        <div className="text-2xl font-semibold text-amber-200">{remaining}</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-300" style={{ width: `${progress}%` }} />
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
    <section className={surfaceClass}>
      <div className="mb-6">
        <p className={sectionEyebrow}>History</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Requests & Decisions</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Leave Requests</h3>
          <div className="mt-4 space-y-3">
            {leaveRequests.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium capitalize text-slate-100">{row.type.replaceAll("_", " ").toLowerCase()} leave</div>
                    <div className="text-xs text-slate-400">
                      {dateFmt.format(new Date(row.startDate))} to {dateFmt.format(new Date(row.endDate))} · {row.daysRequested} day(s)
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
          <h3 className="text-lg font-semibold text-white">Cash Advances</h3>
          <div className="mt-4 space-y-3">
            {cashAdvances.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{currency.format(row.requestedAmount)} requested</div>
                    <div className="text-xs text-slate-400">{dateFmt.format(new Date(row.createdAt))}</div>
                  </div>
                  <StatusBadge value={row.status} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">Approved: {currency.format(row.approvedAmount ?? 0)}</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">Remaining: {currency.format(row.remainingBalance ?? 0)}</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">Cycles: {row.repaymentPeriod ?? "-"}</div>
                </div>
                {row.hrComment ? <div className="mt-2 text-sm text-amber-200">HR: {row.hrComment}</div> : null}
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
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 px-4 py-6 text-sm text-slate-400">{label}</div>;
}
