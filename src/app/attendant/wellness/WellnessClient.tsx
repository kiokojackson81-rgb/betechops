"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/app/_components/Button";
import { toast } from "@/lib/toast";
import { MAX_CASH_ADVANCE_REPAYMENT_PERIOD } from "@/lib/wellnessPolicy";

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
    role?: string | null;
    attendantCategory?: string | null;
  };
  canSubmitPayrollAdjustmentRequest?: boolean;
  staff?: Array<{ id: string; name?: string | null; email: string; attendantCategory?: string | null }>;
  payrollAdjustmentRequests?: PayrollAdjustmentRequestRow[];
  employeeDocuments?: EmployeeDocumentRow[];
  leaveBalance: {
    annual: { entitlement: number; used: number; remaining: number };
    sick: { entitlement: number; used: number; remaining: number };
    emergency: { entitlement: number; used: number; remaining: number };
    totalEntitlement: number;
    totalUsed: number;
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
  cashAdvanceCapacity: {
    salary: number;
    outstandingBalance: number;
    availableToBorrow: number;
  };
};

type EmployeeDocumentRow = {
  id: string;
  documentType: string;
  title: string;
  fileUrl: string;
  notes?: string | null;
  createdAt: string;
  uploadedBy?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type PayrollAdjustmentRequestRow = {
  id: string;
  periodLabel: string;
  offenseType: string;
  adjustmentType: string;
  adjustmentKind: string;
  label: string;
  amount: number;
  incidentDate?: string | null;
  details: string;
  evidenceUrl?: string | null;
  status: string;
  adminComment?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  attendant: { id: string; name?: string | null; email: string; attendantCategory?: string | null };
  requestedBy: { id: string; name?: string | null; email: string; attendantCategory?: string | null };
  decidedBy?: { id: string; name?: string | null; email: string; attendantCategory?: string | null } | null;
};

type WellnessTab = "leave" | "cash" | "documents" | "discipline" | "history" | "balances";

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
const adjustmentOffenseTypes = [
  "THEFT",
  "LATENESS",
  "ABSENT_WITHOUT_NOTICE",
  "FAILURE_TO_REPORT_TO_WORK",
  "INSUBORDINATION",
  "MISCONDUCT",
  "PROPERTY_DAMAGE",
  "CUSTOMER_COMPLAINT",
  "BONUS",
  "OTHER",
];
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

function buildInstallmentPreview(total: number, periods: number) {
  const normalizedTotal = Math.max(0, Math.trunc(Number(total ?? 0)));
  const normalizedPeriods = Math.max(1, Math.trunc(Number(periods ?? 1)));
  if (normalizedTotal <= 0) {
    return Array.from({ length: normalizedPeriods }, () => 0);
  }
  const base = Math.floor(normalizedTotal / normalizedPeriods);
  const remainder = normalizedTotal % normalizedPeriods;
  return Array.from({ length: normalizedPeriods }, (_, index) => base + (index < remainder ? 1 : 0));
}

function formatDocumentType(value: string) {
  return String(value || "OTHER")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState<WellnessTab>("leave");
  const [leaveForm, setLeaveForm] = useState({
    type: "ANNUAL",
    startDate: toDateInput(new Date()),
    endDate: toDateInput(new Date()),
    reason: "",
    supportingDocumentUrl: "",
  });
  const [advanceForm, setAdvanceForm] = useState({
    requestedAmount: "",
    repaymentPeriod: String(MAX_CASH_ADVANCE_REPAYMENT_PERIOD),
    reason: "",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    attendantId: "",
    offenseType: "LATENESS",
    adjustmentKind: "DEDUCTION",
    amount: "",
    incidentDate: toDateInput(new Date()),
    label: "",
    details: "",
    evidenceUrl: "",
  });
  const canSubmitAdjustmentRequest = Boolean(overview?.canSubmitPayrollAdjustmentRequest);
  const tabs: Array<{ id: WellnessTab; label: string; meta: string }> = [
    { id: "leave", label: "Leave", meta: `${overview?.leaveBalance.totalRemaining ?? "-"} days left` },
    { id: "cash", label: "Cash advance", meta: currency.format(overview?.cashAdvanceCapacity.availableToBorrow ?? 0) },
    { id: "documents", label: "Compliance", meta: String(overview?.employeeDocuments?.length ?? 0) },
    ...(canSubmitAdjustmentRequest
      ? [{ id: "discipline" as WellnessTab, label: "Payroll discipline", meta: "Approval required" }]
      : []),
    {
      id: "history",
      label: "History",
      meta: String(
        (overview?.leaveRequests.length ?? 0) +
          (overview?.cashAdvances.length ?? 0) +
          (overview?.payrollAdjustmentRequests?.length ?? 0),
      ),
    },
    { id: "balances", label: "Balances", meta: currency.format(overview?.outstandingAdvanceBalance ?? 0) },
  ];
  const requestedAdvanceAmount = Math.max(0, Math.trunc(Number(advanceForm.requestedAmount ?? 0)));
  const requestedRepaymentMonths = Math.min(
    MAX_CASH_ADVANCE_REPAYMENT_PERIOD,
    Math.max(1, Math.trunc(Number(advanceForm.repaymentPeriod ?? 1) || 1)),
  );
  const requestedInstallments = buildInstallmentPreview(requestedAdvanceAmount, requestedRepaymentMonths);
  const projectedAvailableAfterRequest = Math.max(
    0,
    Number(overview?.cashAdvanceCapacity.availableToBorrow ?? 0) - requestedAdvanceAmount,
  );
  const requestExcessAmount = Math.max(
    0,
    requestedAdvanceAmount - Number(overview?.cashAdvanceCapacity.availableToBorrow ?? 0),
  );

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

  useEffect(() => {
    if (activeTab === "discipline" && !canSubmitAdjustmentRequest) {
      setActiveTab("leave");
    }
  }, [activeTab, canSubmitAdjustmentRequest]);

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
      setAdvanceForm({ requestedAmount: "", repaymentPeriod: String(MAX_CASH_ADVANCE_REPAYMENT_PERIOD), reason: "" });
      await fetchOverview();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to submit cash advance", "error");
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const submitAdjustmentRequest = async () => {
    setSubmittingAdjustment(true);
    try {
      const res = await fetch("/api/payroll-adjustment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendantId: adjustmentForm.attendantId,
          offenseType: adjustmentForm.offenseType,
          adjustmentKind: adjustmentForm.adjustmentKind,
          amount: Number(adjustmentForm.amount),
          incidentDate: adjustmentForm.incidentDate,
          label: adjustmentForm.label,
          details: adjustmentForm.details,
          evidenceUrl: adjustmentForm.evidenceUrl,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to submit adjustment request"));
      toast("Payroll adjustment request sent for admin approval", "success");
      setAdjustmentForm((state) => ({
        ...state,
        attendantId: "",
        amount: "",
        label: "",
        details: "",
        evidenceUrl: "",
        incidentDate: toDateInput(new Date()),
      }));
      await fetchOverview();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to submit adjustment request", "error");
    } finally {
      setSubmittingAdjustment(false);
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

        <WellnessMenu tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="space-y-6">
            {activeTab === "leave" ? (
            <section className={surfaceClass}>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className={sectionEyebrow}>Leave Request</p>
                  <h2 className="text-2xl font-semibold text-white">Submit Leave</h2>
                  <p className="max-w-2xl text-sm leading-6 text-slate-400">
                    Everyone has 10 annual leave days per year. Sick, emergency, and other leave requests all draw from that same yearly allowance. Unpaid leave does not.
                  </p>
                </div>
                <span className="inline-flex h-fit rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
                  {overview?.leaveBalance.totalRemaining ?? 0} day(s) left
                </span>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <MiniInfoCard label="Total allowance" value={String(overview?.leaveBalance.totalEntitlement ?? 10)} />
                <MiniInfoCard label="Used" value={String(overview?.leaveBalance.totalUsed ?? 0)} />
                <MiniInfoCard label="Remaining" value={String(overview?.leaveBalance.totalRemaining ?? 0)} />
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
            ) : null}

            {activeTab === "cash" ? (
            <section className={surfaceClass}>
              <div className="mb-6 space-y-2">
                <p className={sectionEyebrow}>Cash Advance</p>
                <h2 className="text-2xl font-semibold text-white">Request Cash Advance</h2>
                <p className="text-sm leading-6 text-slate-400">
                  You cannot borrow more than your salary, and repayment cannot exceed {MAX_CASH_ADVANCE_REPAYMENT_PERIOD} month.
                </p>
                <p className="text-sm leading-6 text-slate-400">
                  Once approved, the deduction goes to the current payroll immediately.
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
                  <span className="font-medium text-slate-300">Repayment months</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_CASH_ADVANCE_REPAYMENT_PERIOD}
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
                <MiniInfoCard label="Salary cap" value={currency.format(overview?.cashAdvanceCapacity.salary ?? 0)} />
                <MiniInfoCard label="Outstanding" value={currency.format(overview?.outstandingAdvanceBalance ?? 0)} />
                <MiniInfoCard label="Available" value={currency.format(overview?.cashAdvanceCapacity.availableToBorrow ?? 0)} />
                <MiniInfoCard label="After request" value={currency.format(projectedAvailableAfterRequest)} />
                <MiniInfoCard label="Current payroll" value={currency.format(requestedInstallments[0] ?? 0)} />
                <MiniInfoCard label="Next period" value={currency.format(requestedInstallments[1] ?? 0)} />
                <MiniInfoCard label="Upcoming due" value={String(overview?.upcomingInstallments.length ?? 0)} />
              </div>
              {requestedAdvanceAmount > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
                  <div>
                    Preview: {currency.format(requestedInstallments[0] ?? 0)} will be deducted from the current payroll.
                  </div>
                  {requestExcessAmount > 0 ? (
                    <div className="mt-2 text-rose-300">
                      This request exceeds the available borrowing limit by {currency.format(requestExcessAmount)}.
                    </div>
                  ) : null}
                </div>
              ) : null}
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
            ) : null}

            {canSubmitAdjustmentRequest && activeTab === "discipline" ? (
              <section className={surfaceClass}>
                <div className="mb-6 space-y-2">
                  <p className={sectionEyebrow}>Payroll Discipline</p>
                  <h2 className="text-2xl font-semibold text-white">Submit Adjustment Request</h2>
                  <p className="text-sm leading-6 text-slate-400">
                    Supervisor requests stay pending until admin approves them. Approved requests are then applied to the employee payroll.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-300">Employee</span>
                    <select
                      className={inputClass}
                      value={adjustmentForm.attendantId}
                      onChange={(e) => setAdjustmentForm((state) => ({ ...state, attendantId: e.target.value }))}
                    >
                      <option value="">Select employee</option>
                      {(overview?.staff ?? []).map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name || staff.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-300">Offence / reason</span>
                    <select
                      className={inputClass}
                      value={adjustmentForm.offenseType}
                      onChange={(e) => {
                        const offenseType = e.target.value;
                        setAdjustmentForm((state) => ({
                          ...state,
                          offenseType,
                          adjustmentKind: offenseType === "BONUS" ? "ADDITION" : state.adjustmentKind,
                        }));
                      }}
                    >
                      {adjustmentOffenseTypes.map((type) => (
                        <option key={type} value={type}>
                          {formatAdjustmentType(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-300">Kind</span>
                    <select
                      className={inputClass}
                      value={adjustmentForm.adjustmentKind}
                      onChange={(e) => setAdjustmentForm((state) => ({ ...state, adjustmentKind: e.target.value }))}
                    >
                      <option value="DEDUCTION">Deduction</option>
                      <option value="ADDITION">Addition</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-300">Amount (KES)</span>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={adjustmentForm.amount}
                      onChange={(e) => setAdjustmentForm((state) => ({ ...state, amount: e.target.value }))}
                      placeholder="Amount"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-300">Incident date</span>
                    <input
                      type="date"
                      className={inputClass}
                      value={adjustmentForm.incidentDate}
                      onChange={(e) => setAdjustmentForm((state) => ({ ...state, incidentDate: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-300">Short label</span>
                    <input
                      className={inputClass}
                      value={adjustmentForm.label}
                      onChange={(e) => setAdjustmentForm((state) => ({ ...state, label: e.target.value }))}
                      placeholder="Late clock-in time, theft case, bonus..."
                    />
                  </label>
                </div>
                <label className="mt-4 block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Details</span>
                  <textarea
                    className={`${inputClass} min-h-32 resize-y`}
                    value={adjustmentForm.details}
                    onChange={(e) => setAdjustmentForm((state) => ({ ...state, details: e.target.value }))}
                    placeholder="Explain what happened and why this amount should be deducted or added."
                  />
                </label>
                <label className="mt-4 block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Evidence URL</span>
                  <input
                    className={inputClass}
                    value={adjustmentForm.evidenceUrl}
                    onChange={(e) => setAdjustmentForm((state) => ({ ...state, evidenceUrl: e.target.value }))}
                    placeholder="Optional evidence link"
                  />
                </label>
                <div className="mt-5 flex justify-end">
                  <Button
                    onClick={() => void submitAdjustmentRequest()}
                    disabled={submittingAdjustment || loading}
                    className="min-w-[220px] w-full border border-amber-200/80 bg-amber-300 text-slate-950 shadow-[0_12px_30px_rgba(252,211,77,.22)] hover:bg-amber-200 sm:w-auto"
                  >
                    {submittingAdjustment ? "Submitting..." : "Send for admin approval"}
                  </Button>
                </div>
              </section>
            ) : null}

            {activeTab === "history" ? (
            <HistorySection
              leaveRequests={overview?.leaveRequests ?? []}
              cashAdvances={overview?.cashAdvances ?? []}
              payrollAdjustmentRequests={overview?.payrollAdjustmentRequests ?? []}
              loading={loading}
            />
            ) : null}

          {activeTab === "documents" ? (
            <section className={surfaceClass}>
              <div className="mb-6">
                <p className={sectionEyebrow}>Compliance</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Employment Documents</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Admin uploads your employment documents here, including ID copies, contracts, licences, certificates, and other compliance records.
                </p>
              </div>
              <div className="space-y-3">
                {(overview?.employeeDocuments ?? []).map((document) => (
                  <div key={document.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                          {formatDocumentType(document.documentType)}
                        </div>
                        <div className="mt-1 font-medium text-slate-100">{document.title}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          Uploaded {dateFmt.format(new Date(document.createdAt))}
                          {document.uploadedBy ? ` · by ${document.uploadedBy.name || document.uploadedBy.email}` : ""}
                        </div>
                        {document.notes ? <div className="mt-2 text-sm text-slate-300">{document.notes}</div> : null}
                      </div>
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-fit rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-sm font-medium text-amber-100"
                      >
                        Open document
                      </a>
                    </div>
                  </div>
                ))}
                {!overview?.employeeDocuments?.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
                    No employment documents have been uploaded yet.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeTab === "balances" ? (
          <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
            <section className={surfaceClass}>
              <p className={sectionEyebrow}>Balances</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Leave Balance</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                This is a shared 10-day annual leave allowance for the current year. Sick, emergency, and other leave requests use the same balance.
              </p>
              <div className="mt-4 grid gap-3">
                <BalanceRow
                  label="Total paid leave"
                  data={{
                    entitlement: overview?.leaveBalance.totalEntitlement ?? 10,
                    used: overview?.leaveBalance.totalUsed ?? 0,
                    remaining: overview?.leaveBalance.totalRemaining ?? 0,
                  }}
                />
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
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WellnessMenu({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: WellnessTab; label: string; meta: string }>;
  activeTab: WellnessTab;
  onChange: (tab: WellnessTab) => void;
}) {
  return (
    <section className="rounded-[28px] border border-slate-800/90 bg-slate-950/70 p-2 shadow-[0_20px_60px_rgba(2,6,23,.28)]">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`min-h-20 min-w-[170px] flex-1 rounded-3xl border px-4 py-3 text-left transition ${
                active
                  ? "border-amber-300/70 bg-amber-300 text-slate-950 shadow-[0_12px_34px_rgba(251,191,36,.22)]"
                  : "border-slate-800 bg-slate-900/75 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
              }`}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className={`mt-2 text-xs ${active ? "text-slate-800" : "text-slate-400"}`}>{tab.meta}</div>
            </button>
          );
        })}
      </div>
    </section>
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
  payrollAdjustmentRequests,
  loading,
}: {
  leaveRequests: LeaveRow[];
  cashAdvances: CashAdvanceRow[];
  payrollAdjustmentRequests: PayrollAdjustmentRequestRow[];
  loading: boolean;
}) {
  return (
    <section className={surfaceClass}>
      <div className="mb-6">
        <p className={sectionEyebrow}>History</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Requests & Decisions</h2>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
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
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">Repayment: {row.repaymentPeriod ?? "-"} month</div>
                </div>
                {row.hrComment ? <div className="mt-2 text-sm text-amber-200">HR: {row.hrComment}</div> : null}
              </div>
            ))}
            {!cashAdvances.length && !loading ? <EmptyCard label="No cash advances yet." /> : null}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">Payroll Adjustments</h3>
          <div className="mt-4 space-y-3">
            {payrollAdjustmentRequests.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{row.label}</div>
                    <div className="text-xs text-slate-400">
                      {row.attendant.name || row.attendant.email} · {formatAdjustmentType(row.offenseType)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{row.periodLabel}</div>
                  </div>
                  <StatusBadge value={row.status} />
                </div>
                <div className={row.adjustmentKind === "ADDITION" ? "mt-3 font-semibold text-emerald-200" : "mt-3 font-semibold text-rose-200"}>
                  {row.adjustmentKind === "ADDITION" ? "+" : "-"}
                  {currency.format(row.amount)}
                </div>
                <p className="mt-2 text-sm text-slate-300">{row.details}</p>
                {row.adminComment ? <p className="mt-2 text-xs text-amber-200">Admin: {row.adminComment}</p> : null}
              </div>
            ))}
            {!payrollAdjustmentRequests.length && !loading ? <EmptyCard label="No payroll adjustment requests yet." /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatAdjustmentType(value: string) {
  return String(value || "OTHER")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
