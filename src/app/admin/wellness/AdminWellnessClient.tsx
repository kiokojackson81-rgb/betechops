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
  createdAt: string;
  user: { id: string; name?: string | null; email: string; phone?: string | null; attendantCategory?: string | null };
};

type CashAdvance = {
  id: string;
  requestedAmount: number;
  approvedAmount?: number | null;
  status: string;
  reason: string;
  repaymentPeriod?: number | null;
  remainingBalance: number;
  createdAt: string;
  hrComment?: string | null;
  user: { id: string; name?: string | null; email: string; phone?: string | null; attendantCategory?: string | null };
  installments?: Array<{ id: string; dueDate: string; amount: number; isPaid: boolean }>;
};

type PayrollAdjustmentRequest = {
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
  attendant: { id: string; name?: string | null; email: string; phone?: string | null; attendantCategory?: string | null };
  requestedBy: { id: string; name?: string | null; email: string; phone?: string | null; attendantCategory?: string | null };
};

type LeaveBalance = {
  id: string;
  annualEntitlement: number;
  sickEntitlement: number;
  emergencyEntitlement: number;
  annualUsed: number;
  sickUsed: number;
  emergencyUsed: number;
  user: { id: string; name?: string | null; email: string; phone?: string | null; attendantCategory?: string | null };
};

type SummaryResponse = {
  pendingLeaveRequests: LeaveRequest[];
  pendingCashAdvances: CashAdvance[];
  pendingAdjustmentRequests: PayrollAdjustmentRequest[];
  recentLeaveRequests: LeaveRequest[];
  recentCashAdvances: CashAdvance[];
  recentAdjustmentRequests: PayrollAdjustmentRequest[];
  outstandingAdvances: CashAdvance[];
  leaveBalances: LeaveBalance[];
  totals: {
    pendingLeaveCount: number;
    pendingCashAdvanceCount: number;
    pendingAdjustmentRequestCount: number;
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
  const [downloadingCashAdvanceId, setDownloadingCashAdvanceId] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [leaveComments, setLeaveComments] = useState<Record<string, string>>({});
  const [advanceForms, setAdvanceForms] = useState<Record<string, { approvedAmount: string; repaymentPeriod: string; hrComment: string }>>({});
  const [recentAdvanceDrafts, setRecentAdvanceDrafts] = useState<
    Record<string, { userId: string; requestedAmount: string; approvedAmount: string; repaymentPeriod: string; reason: string; hrComment: string }>
  >({});
  const [adjustmentForms, setAdjustmentForms] = useState<Record<string, { amount: string; adminComment: string }>>({});
  const [balanceDrafts, setBalanceDrafts] = useState<Record<string, { annualEntitlement: string; sickEntitlement: string; emergencyEntitlement: string }>>({});
  const [expandedRecentAdvanceId, setExpandedRecentAdvanceId] = useState<string | null>(null);
  const [recentWellnessTab, setRecentWellnessTab] = useState<"leave" | "cash" | "payroll">("cash");
  const [adminAdvanceForm, setAdminAdvanceForm] = useState({
    userId: "",
    requestedAmount: "",
    repaymentPeriod: "1",
    reason: "",
  });

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

    const nextRecentAdvanceDrafts: Record<
      string,
      { userId: string; requestedAmount: string; approvedAmount: string; repaymentPeriod: string; reason: string; hrComment: string }
    > = {};
    for (const row of data.recentCashAdvances) {
      nextRecentAdvanceDrafts[row.id] = {
        userId: row.user.id,
        requestedAmount: String(row.requestedAmount ?? ""),
        approvedAmount: String(row.approvedAmount ?? row.requestedAmount ?? ""),
        repaymentPeriod: String(Math.max(1, Number(row.repaymentPeriod ?? 1))),
        reason: row.reason ?? "",
        hrComment: row.hrComment ?? "",
      };
    }
    setRecentAdvanceDrafts(nextRecentAdvanceDrafts);

    const nextAdjustmentForms: Record<string, { amount: string; adminComment: string }> = {};
    for (const row of data.pendingAdjustmentRequests) {
      nextAdjustmentForms[row.id] = {
        amount: String(row.amount ?? ""),
        adminComment: "",
      };
    }
    setAdjustmentForms(nextAdjustmentForms);

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
    () =>
      data?.totals ?? {
        pendingLeaveCount: 0,
        pendingCashAdvanceCount: 0,
        pendingAdjustmentRequestCount: 0,
        outstandingAdvanceBalance: 0,
      },
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

  const decideAdjustment = async (id: string, decision: "APPROVED" | "REJECTED") => {
    try {
      const form = adjustmentForms[id];
      const res = await fetch(`/api/payroll-adjustment-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          amount: form?.amount,
          adminComment: form?.adminComment ?? "",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to update adjustment request"));
      toast(`Payroll adjustment request ${decision.toLowerCase()}`, "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to update adjustment request", "error");
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

  const downloadCashAdvanceOpenfloatFile = async (cashAdvanceId: string) => {
    setDownloadingCashAdvanceId(cashAdvanceId);
    try {
      const res = await fetch(
        `/api/admin/wellness/cash-advances/openfloat?cashAdvanceId=${encodeURIComponent(cashAdvanceId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(String(body?.detail ?? body?.error ?? "Failed to prepare the OpenFloat file"));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "openfloat-cash-advance.xlsx";
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      toast("OpenFloat file for this cash advance downloaded", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to download the OpenFloat file", "error");
    } finally {
      setDownloadingCashAdvanceId(null);
    }
  };

  const staffOptions = useMemo(
    () =>
      (data?.leaveBalances ?? []).map((balance) => ({
        id: balance.user.id,
        label: balance.user.name || balance.user.email,
        sub: balance.user.email,
      })),
    [data],
  );

  const createAdminAdvance = async () => {
    try {
      if (!adminAdvanceForm.userId) throw new Error("Select staff");
      const requestedAmount = Math.trunc(Number(adminAdvanceForm.requestedAmount ?? 0));
      const repaymentPeriod = Math.trunc(Number(adminAdvanceForm.repaymentPeriod ?? 0));
      const reason = adminAdvanceForm.reason.trim();
      if (requestedAmount <= 0) throw new Error("Requested amount must be greater than zero");
      if (repaymentPeriod <= 0) throw new Error("Repayment period must be at least 1 month");
      if (!reason) throw new Error("Reason is required");
      const res = await fetch(`/api/cash-advance?impersonateId=${encodeURIComponent(adminAdvanceForm.userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedAmount,
          repaymentPeriod,
          reason,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to create cash advance"));
      toast("Cash advance created and approved", "success");
      setAdminAdvanceForm({ userId: "", requestedAmount: "", repaymentPeriod: "1", reason: "" });
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to create cash advance", "error");
    }
  };

  const updateRecentAdvance = async (id: string) => {
    try {
      const draft = recentAdvanceDrafts[id];
      if (!draft) return;
      const res = await fetch(`/api/cash-advance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: draft.userId,
          requestedAmount: Number(draft.requestedAmount),
          approvedAmount: Number(draft.approvedAmount),
          repaymentPeriod: Number(draft.repaymentPeriod),
          reason: draft.reason,
          hrComment: draft.hrComment,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to update cash advance"));
      toast("Cash advance updated", "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to update cash advance", "error");
    }
  };

  const deleteRecentAdvance = async (id: string) => {
    try {
      if (typeof window !== "undefined" && !window.confirm("Delete this cash advance application?")) return;
      const res = await fetch(`/api/cash-advance/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to delete cash advance"));
      toast("Cash advance deleted", "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to delete cash advance", "error");
    }
  };

  const editLeaveRequest = async (row: LeaveRequest) => {
    if (typeof window === "undefined") return;
    const startDate = window.prompt("Start date (YYYY-MM-DD)", row.startDate.slice(0, 10));
    if (startDate == null) return;
    const endDate = window.prompt("End date (YYYY-MM-DD)", row.endDate.slice(0, 10));
    if (endDate == null) return;
    const type = window.prompt("Leave type", row.type);
    if (type == null) return;
    const reason = window.prompt("Reason", row.reason);
    if (reason == null) return;
    try {
      const res = await fetch(`/api/leave/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, type, reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to update leave request"));
      toast("Leave request updated", "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to update leave request", "error");
    }
  };

  const deleteLeaveRequest = async (id: string) => {
    try {
      if (typeof window !== "undefined" && !window.confirm("Delete this leave request?")) return;
      const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to delete leave request"));
      toast("Leave request deleted", "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to delete leave request", "error");
    }
  };

  const editAdjustmentRequest = async (row: PayrollAdjustmentRequest) => {
    if (typeof window === "undefined") return;
    const amount = window.prompt("Amount", String(row.amount));
    if (amount == null) return;
    const label = window.prompt("Label", row.label);
    if (label == null) return;
    const details = window.prompt("Details", row.details);
    if (details == null) return;
    const incidentDate = window.prompt("Incident date (YYYY-MM-DD, optional)", row.incidentDate ? row.incidentDate.slice(0, 10) : "");
    if (incidentDate == null) return;
    try {
      const res = await fetch(`/api/payroll-adjustment-requests/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), label, details, incidentDate }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to update adjustment request"));
      toast("Payroll adjustment updated", "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to update adjustment request", "error");
    }
  };

  const deleteAdjustmentRequest = async (id: string) => {
    try {
      if (typeof window !== "undefined" && !window.confirm("Delete this payroll adjustment request?")) return;
      const res = await fetch(`/api/payroll-adjustment-requests/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to delete adjustment request"));
      toast("Payroll adjustment deleted", "success");
      await fetchSummary();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to delete adjustment request", "error");
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
            <Stat label="Pending adjustments" value={String(totals.pendingAdjustmentRequestCount)} />
            <Stat label="Outstanding balance" value={currency.format(totals.outstandingAdvanceBalance)} />
            <Button onClick={() => void processDueInstallments()} disabled={processing || loading}>
              {processing ? "Processing..." : "Run due deductions"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Create Cash Advance</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Admin may approve an advance above the employee&apos;s available salary limit when necessary.
          Staff requests and supervisor approvals remain restricted to the salary-based limit.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Staff</span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none"
              value={adminAdvanceForm.userId}
              onChange={(e) => setAdminAdvanceForm((state) => ({ ...state, userId: e.target.value }))}
            >
              <option value="">Select staff</option>
              {staffOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label} - {option.sub}</option>
              ))}
            </select>
          </label>
          <Field
            label="Requested amount"
            value={adminAdvanceForm.requestedAmount}
            onChange={(value) => setAdminAdvanceForm((state) => ({ ...state, requestedAmount: value }))}
          />
          <Field
            label="Repayment months"
            value={adminAdvanceForm.repaymentPeriod}
            onChange={(value) => setAdminAdvanceForm((state) => ({ ...state, repaymentPeriod: value }))}
          />
          <Field
            label="Reason"
            value={adminAdvanceForm.reason}
            onChange={(value) => setAdminAdvanceForm((state) => ({ ...state, reason: value }))}
          />
        </div>
          <div className="mt-4">
            <Button
              onClick={() => void createAdminAdvance()}
              className="min-w-[180px] rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.25)] hover:brightness-95"
            >
              Create advance
            </Button>
          </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recent Wellness Applications</h2>
            <p className="mt-1 text-sm text-slate-400">
              Admin can review both pending and already-decided front-side applications here.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRecentWellnessTab("leave")}
            className={`inline-flex min-h-[2.9rem] items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              recentWellnessTab === "leave"
                ? "bg-white text-slate-950"
                : "border border-white/10 bg-slate-950/50 text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            Leave requests
          </button>
          <button
            type="button"
            onClick={() => setRecentWellnessTab("cash")}
            className={`inline-flex min-h-[2.9rem] items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              recentWellnessTab === "cash"
                ? "bg-white text-slate-950"
                : "border border-white/10 bg-slate-950/50 text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            Cash advances
          </button>
          <button
            type="button"
            onClick={() => setRecentWellnessTab("payroll")}
            className={`inline-flex min-h-[2.9rem] items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              recentWellnessTab === "payroll"
                ? "bg-white text-slate-950"
                : "border border-white/10 bg-slate-950/50 text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            Payroll adjustments
          </button>
        </div>

        <div className="mt-4">
          {recentWellnessTab === "leave" ? (
            <section className="space-y-3">
              <div className="text-sm font-semibold text-slate-200">Leave requests</div>
              {(data?.recentLeaveRequests ?? []).slice(0, 12).map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-100">{row.user.name || row.user.email}</div>
                      <div className="text-xs text-slate-400">
                        {row.type} · {row.daysRequested} day(s) · {dateFmt.format(new Date(row.createdAt))}
                      </div>
                      {row.user.phone ? <div className="text-xs text-slate-500">{row.user.phone}</div> : null}
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{row.reason}</div>
                  <div className="mt-3 flex gap-3">
                    {String(row.status).toUpperCase() === "PENDING" ? (
                      <>
                        <Button onClick={() => void decideLeave(row.id, "APPROVED")}>Approve</Button>
                        <Button variant="secondary" onClick={() => void decideLeave(row.id, "REJECTED")}>Reject</Button>
                      </>
                    ) : null}
                    <Button variant="secondary" onClick={() => void editLeaveRequest(row)}>Edit</Button>
                    <Button variant="secondary" onClick={() => void deleteLeaveRequest(row.id)}>Delete</Button>
                  </div>
                </div>
              ))}
              {!data?.recentLeaveRequests?.length && !loading ? <EmptyCard label="No leave requests yet." /> : null}
            </section>
          ) : null}

          {recentWellnessTab === "cash" ? (
            <section className="space-y-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Cash advances</div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Open an approved request and download its own OpenFloat-ready Excel file. Each download contains only that one cash advance.
                  </p>
                </div>
              </div>
              {(data?.recentCashAdvances ?? []).length ? (
                <div className="space-y-3">
                  {(data?.recentCashAdvances ?? []).slice(0, 12).map((row) => {
                    const isExpanded = expandedRecentAdvanceId === row.id;
                    return (
                      <div key={row.id} className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/35">
                        <button
                          type="button"
                          onClick={() => setExpandedRecentAdvanceId((current) => (current === row.id ? null : row.id))}
                          className="grid w-full gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03] md:grid-cols-[1.2fr_.8fr_.65fr_.8fr_.9fr_auto] md:items-center"
                          aria-expanded={isExpanded}
                        >
                          <div>
                            <div className="font-medium text-slate-100">{row.user.name || row.user.email}</div>
                            <div className="text-xs text-slate-400">{row.user.email}</div>
                            {row.user.phone ? <div className="text-xs text-slate-500">{row.user.phone}</div> : null}
                            <div className="mt-2 text-sm text-slate-300 md:hidden">{row.reason}</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {currency.format(row.approvedAmount ?? row.requestedAmount)}
                            </div>
                            <div className="text-xs text-slate-400">Requested {currency.format(row.requestedAmount)}</div>
                          </div>
                          <div className="text-sm text-slate-200">
                            {recentAdvanceDrafts[row.id]?.repaymentPeriod ?? String(Math.max(1, Number(row.repaymentPeriod ?? 1)))} month(s)
                          </div>
                          <div>
                            <StatusBadge status={row.status} />
                          </div>
                          <div className="text-sm text-slate-300">{dateFmt.format(new Date(row.createdAt))}</div>
                          <div className="flex items-center justify-start md:justify-end">
                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-lg text-slate-200">
                              {isExpanded ? "−" : "⌄"}
                            </span>
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-white/5 px-4 pb-4">
                            <div className="mt-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                              <div className="mb-3 text-sm text-slate-300">{row.reason}</div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-2 text-sm">
                                  <span className="text-slate-300">Staff</span>
                                  <select
                                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none"
                                    value={recentAdvanceDrafts[row.id]?.userId ?? row.user.id}
                                    onChange={(e) =>
                                      setRecentAdvanceDrafts((state) => ({
                                        ...state,
                                        [row.id]: { ...state[row.id], userId: e.target.value },
                                      }))
                                    }
                                  >
                                    {staffOptions.map((option) => (
                                      <option key={option.id} value={option.id}>{option.label} - {option.sub}</option>
                                    ))}
                                  </select>
                                </label>
                                <Field
                                  label="Repayment months"
                                  value={recentAdvanceDrafts[row.id]?.repaymentPeriod ?? String(Math.max(1, Number(row.repaymentPeriod ?? 1)))}
                                  onChange={(value) =>
                                    setRecentAdvanceDrafts((state) => ({
                                      ...state,
                                      [row.id]: { ...state[row.id], repaymentPeriod: value },
                                    }))
                                  }
                                />
                                <Field
                                  label="Requested amount"
                                  value={recentAdvanceDrafts[row.id]?.requestedAmount ?? String(row.requestedAmount)}
                                  onChange={(value) =>
                                    setRecentAdvanceDrafts((state) => ({
                                      ...state,
                                      [row.id]: { ...state[row.id], requestedAmount: value },
                                    }))
                                  }
                                />
                                <Field
                                  label="Approved amount"
                                  value={recentAdvanceDrafts[row.id]?.approvedAmount ?? String(row.approvedAmount ?? row.requestedAmount)}
                                  onChange={(value) =>
                                    setRecentAdvanceDrafts((state) => ({
                                      ...state,
                                      [row.id]: { ...state[row.id], approvedAmount: value },
                                    }))
                                  }
                                />
                                <Field
                                  label="Reason"
                                  value={recentAdvanceDrafts[row.id]?.reason ?? row.reason}
                                  onChange={(value) =>
                                    setRecentAdvanceDrafts((state) => ({
                                      ...state,
                                      [row.id]: { ...state[row.id], reason: value },
                                    }))
                                  }
                                />
                                <Field
                                  label="HR comment"
                                  value={recentAdvanceDrafts[row.id]?.hrComment ?? ""}
                                  onChange={(value) =>
                                    setRecentAdvanceDrafts((state) => ({
                                      ...state,
                                      [row.id]: { ...state[row.id], hrComment: value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="mt-3 flex gap-3">
                                {String(row.status).toUpperCase() === "PENDING" ? (
                                  <>
                                    <Button onClick={() => void decideAdvance(row.id, "APPROVED")}>Approve</Button>
                                    <Button variant="secondary" onClick={() => void decideAdvance(row.id, "REJECTED")}>Reject</Button>
                                  </>
                                ) : null}
                                {String(row.status).toUpperCase() === "APPROVED" ? (
                                  <Button
                                    variant="secondary"
                                    onClick={() => void downloadCashAdvanceOpenfloatFile(row.id)}
                                    disabled={downloadingCashAdvanceId !== null}
                                  >
                                    {downloadingCashAdvanceId === row.id
                                      ? "Preparing OpenFloat file..."
                                      : "Download OpenFloat file"}
                                  </Button>
                                ) : null}
                                <Button variant="secondary" onClick={() => void updateRecentAdvance(row.id)}>Save changes</Button>
                                <Button variant="secondary" onClick={() => void deleteRecentAdvance(row.id)}>Delete</Button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {!data?.recentCashAdvances?.length && !loading ? <EmptyCard label="No cash advance requests yet." /> : null}
            </section>
          ) : null}

          {recentWellnessTab === "payroll" ? (
            <section className="space-y-3">
              <div className="text-sm font-semibold text-slate-200">Payroll adjustments</div>
              {(data?.recentAdjustmentRequests ?? []).slice(0, 12).map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-100">{row.attendant.name || row.attendant.email}</div>
                      <div className="text-xs text-slate-400">
                        {row.label} · {currency.format(row.amount)} · {dateFmt.format(new Date(row.createdAt))}
                      </div>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{row.details}</div>
                  <div className="mt-3 flex gap-3">
                    <Button variant="secondary" onClick={() => void editAdjustmentRequest(row)}>Edit</Button>
                    <Button variant="secondary" onClick={() => void deleteAdjustmentRequest(row.id)}>Delete</Button>
                  </div>
                </div>
              ))}
              {!data?.recentAdjustmentRequests?.length && !loading ? <EmptyCard label="No payroll adjustment requests yet." /> : null}
            </section>
          ) : null}
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
                  Maximum repayment period is {MAX_CASH_ADVANCE_REPAYMENT_PERIOD} month.
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Approval schedules the deduction for the current payroll.
                </div>
              </div>
            ))}
            {!data?.pendingCashAdvances?.length && !loading ? <EmptyCard label="No pending cash advances." /> : null}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Pending Payroll Adjustment Requests</h2>
        <div className="mt-4 space-y-4">
          {(data?.pendingAdjustmentRequests ?? []).map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
                <div>
                  <div className="font-medium text-slate-100">{row.label}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {row.attendant.name || row.attendant.email} · {formatAdjustmentType(row.offenseType)} · {row.periodLabel}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Submitted by {row.requestedBy.name || row.requestedBy.email}
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{row.details}</p>
                  {row.evidenceUrl ? (
                    <a className="mt-2 inline-block text-xs text-emerald-200 underline" href={row.evidenceUrl} target="_blank" rel="noreferrer">
                      View evidence
                    </a>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label={row.adjustmentKind === "ADDITION" ? "Addition amount" : "Deduction amount"}
                    value={adjustmentForms[row.id]?.amount ?? String(row.amount)}
                    onChange={(value) =>
                      setAdjustmentForms((state) => ({
                        ...state,
                        [row.id]: { ...state[row.id], amount: value },
                      }))
                    }
                  />
                  <Field
                    label="Admin comment"
                    value={adjustmentForms[row.id]?.adminComment ?? ""}
                    onChange={(value) =>
                      setAdjustmentForms((state) => ({
                        ...state,
                        [row.id]: { ...state[row.id], adminComment: value },
                      }))
                    }
                  />
                  <div className={row.adjustmentKind === "ADDITION" ? "text-emerald-200" : "text-rose-200"}>
                    {row.adjustmentKind === "ADDITION" ? "+" : "-"}
                    {currency.format(Number(adjustmentForms[row.id]?.amount || row.amount || 0))}
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => void decideAdjustment(row.id, "APPROVED")}>Approve</Button>
                    <Button variant="secondary" onClick={() => void decideAdjustment(row.id, "REJECTED")}>Reject</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!data?.pendingAdjustmentRequests?.length && !loading ? <EmptyCard label="No pending payroll adjustment requests." /> : null}
        </div>
      </section>

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
                    <div className="text-xs text-slate-400">{row.repaymentPeriod ?? 0} month</div>
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

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "").toUpperCase();
  const tone =
    normalized === "APPROVED"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : normalized === "REJECTED"
        ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
        : "border-amber-300/30 bg-amber-500/10 text-amber-100";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {normalized || "PENDING"}
    </span>
  );
}

function formatAdjustmentType(value: string) {
  return String(value || "OTHER")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
