"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import Input from "@/app/_components/Input";
import Textarea from "@/app/_components/Textarea";
import { showToast } from "@/lib/ui/toast";

type Installment = {
  id: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  deductedAt?: string | null;
};

type CashAdvanceRow = {
  id: string;
  requestedAmount: number;
  approvedAmount?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  repaymentPeriod?: number | null;
  installmentAmount?: number | null;
  remainingBalance?: number | null;
  hrComment?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  installments?: Installment[];
};

type PayrollSummary = {
  netPay?: number;
  totalDeductions?: number;
  adjustmentEntries?: Array<{
    id: string;
    label?: string;
    amount?: number;
    adjustmentKind?: string;
    kind?: string;
  }>;
};

const formatKes = (value: number | null | undefined) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const statusClasses: Record<CashAdvanceRow["status"], string> = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  REJECTED: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

export default function CashAdvanceClient() {
  const [rows, setRows] = useState<CashAdvanceRow[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [requestedAmount, setRequestedAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const pendingRequest = useMemo(
    () => rows.find((row) => row.status === "PENDING") ?? null,
    [rows],
  );
  const outstandingBalance = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.remainingBalance ?? 0), 0),
    [rows],
  );
  const postedThisPeriod = useMemo(() => {
    const entries = Array.isArray(summary?.adjustmentEntries) ? summary.adjustmentEntries : [];
    return entries.reduce((sum, entry) => {
      const label = String(entry.label ?? "").toLowerCase();
      const kind = String(entry.adjustmentKind ?? entry.kind ?? "DEDUCTION").toUpperCase();
      if (kind !== "DEDUCTION" || !label.includes("cash advance")) return sum;
      return sum + Number(entry.amount ?? 0);
    }, 0);
  }, [summary]);

  async function loadData() {
    setLoading(true);
    try {
      const [advancesRes, payrollRes] = await Promise.all([
        fetch("/api/cash-advance", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/attendant/earnings/summary", { cache: "no-store", credentials: "same-origin" }),
      ]);

      const advancesPayload = advancesRes.ok ? await advancesRes.json().catch(() => null) : null;
      const payrollPayload = payrollRes.ok ? await payrollRes.json().catch(() => null) : null;

      const advanceData = advancesPayload?.data ?? advancesPayload;
      setRows(Array.isArray(advanceData?.rows) ? advanceData.rows : []);
      const payrollData = payrollPayload?.data ?? payrollPayload;
      setSummary(payrollData);
    } catch {
      showToast("Failed to load cash advance details", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submitRequest() {
    const amount = Math.trunc(Math.max(0, Number(requestedAmount || 0)));
    if (amount <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    if (!reason.trim()) {
      showToast("Reason is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cash-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedAmount: amount,
          reason: reason.trim(),
          repaymentPeriod: 1,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to submit cash advance request");
      }
      showToast("Cash advance request submitted", "success");
      setRequestedAmount("");
      setReason("");
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to submit cash advance request", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Payroll Cash Advance</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Request cash support and track it against payroll.</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Submit one request, wait for admin approval, and see approved deductions reflected in your payroll account.
          </p>
        </div>
        <Link
          href="/attendant"
          className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
        >
          Back to dashboard
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/80">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Posted this period</p>
          <p className="mt-3 text-3xl font-semibold text-rose-300">{formatKes(postedThisPeriod)}</p>
          <p className="mt-2 text-sm text-slate-400">Cash-advance deductions already posted in this payroll window.</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900/80">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Outstanding balance</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatKes(outstandingBalance)}</p>
          <p className="mt-2 text-sm text-slate-400">Remaining approved advance not yet cleared.</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900/80">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Net pay</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">{formatKes(summary?.netPay ?? 0)}</p>
          <p className="mt-2 text-sm text-slate-400">Payroll updates after admin approval in the payroll account.</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="border-slate-800 bg-slate-900/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">New request</h2>
              <p className="mt-1 text-sm text-slate-400">Admin reviews this from your payroll page and either approves or rejects it there.</p>
            </div>
            {pendingRequest ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                Pending request
              </span>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Requested amount (KES)</label>
              <Input
                type="number"
                min="1"
                value={requestedAmount}
                onChange={(event) => setRequestedAmount(event.target.value)}
                placeholder="Enter amount"
                disabled={submitting || Boolean(pendingRequest)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reason</label>
              <Textarea
                rows={6}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why do you need this cash advance?"
                disabled={submitting || Boolean(pendingRequest)}
                className="border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">One request at a time keeps payroll review clean and prevents duplicate deductions.</p>
              <Button type="button" variant="primary" onClick={submitRequest} disabled={submitting || Boolean(pendingRequest)}>
                {submitting ? "Submitting..." : "Submit request"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80">
          <h2 className="text-xl font-semibold text-white">Request history</h2>
          <p className="mt-1 text-sm text-slate-400">See approval status, comments, and deduction progress.</p>

          <div className="mt-5 space-y-3">
            {loading ? <p className="text-sm text-slate-400">Loading requests...</p> : null}
            {!loading && rows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
                No cash advance requests yet.
              </p>
            ) : null}
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatKes(row.requestedAmount)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Requested {new Date(row.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClasses[row.status]}`}>
                    {row.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{row.reason}</p>
                {row.approvedAmount ? (
                  <p className="mt-3 text-sm text-emerald-300">Approved amount: {formatKes(row.approvedAmount)}</p>
                ) : null}
                {typeof row.remainingBalance === "number" ? (
                  <p className="mt-1 text-xs text-slate-400">Remaining balance: {formatKes(row.remainingBalance)}</p>
                ) : null}
                {row.hrComment ? (
                  <p className="mt-3 rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                    {row.hrComment}
                  </p>
                ) : null}
                {Array.isArray(row.installments) && row.installments.length > 0 ? (
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    {row.installments.map((installment, index) => (
                      <div key={installment.id} className="flex items-center justify-between">
                        <span>Installment {index + 1}</span>
                        <span>
                          {formatKes(installment.amount)} • {installment.isPaid ? "Deducted" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
