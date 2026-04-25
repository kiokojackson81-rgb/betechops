"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import Input from "@/app/_components/Input";
import Textarea from "@/app/_components/Textarea";
import { showToast } from "@/lib/ui/toast";
import { withImpersonateId } from "@/lib/impersonation";

type CashAdvanceRow = {
  id: string;
  requestedAmount: number;
  approvedAmount?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  adminComment?: string | null;
  approvedAt?: string | null;
  createdAt: string;
};

const statusClasses: Record<CashAdvanceRow["status"], string> = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  REJECTED: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

function formatKes(value: number | null | undefined) {
  return `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function readImpersonateId() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("impersonateId");
}

export default function CashAdvanceClient() {
  const [rows, setRows] = useState<CashAdvanceRow[]>([]);
  const [requestedAmount, setRequestedAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const pendingRequest = useMemo(
    () => rows.find((row) => row.status === "PENDING") ?? null,
    [rows],
  );

  async function loadRows() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const impersonateId = readImpersonateId();
      if (impersonateId) params.set("impersonateId", impersonateId);
      const url = `/api/cash-advance${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to load cash advances");
      const data = payload?.data ?? payload;
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load cash advances", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  async function submitRequest() {
    const amount = Math.trunc(Number(requestedAmount || 0));
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
      const params = new URLSearchParams();
      const impersonateId = readImpersonateId();
      if (impersonateId) params.set("impersonateId", impersonateId);
      const url = `/api/cash-advance${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedAmount: amount,
          reason: reason.trim(),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to submit cash advance request");
      }
      showToast("Cash advance request submitted", "success");
      setRequestedAmount("");
      setReason("");
      await loadRows();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to submit cash advance request", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const impersonateId = readImpersonateId();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Cash Advance</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Request a cash advance without changing payroll logic.</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Submit a request here. Admin will approve or reject it inside your payroll account, and approved requests post as a normal payroll deduction.
          </p>
        </div>
        <Link
          href={withImpersonateId("/attendant", impersonateId)}
          className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
        >
          Back to dashboard
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/80">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Requests</p>
          <p className="mt-3 text-3xl font-semibold text-white">{rows.length}</p>
          <p className="mt-2 text-sm text-slate-400">All cash-advance requests on your account.</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900/80">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-amber-300">{rows.filter((row) => row.status === "PENDING").length}</p>
          <p className="mt-2 text-sm text-slate-400">Only one pending request is allowed at a time.</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900/80">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Approved total</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">
            {formatKes(rows.reduce((sum, row) => sum + Number(row.approvedAmount ?? 0), 0))}
          </p>
          <p className="mt-2 text-sm text-slate-400">Approved amounts that were posted through payroll deductions.</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <Card className="border-slate-800 bg-slate-900/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">New request</h2>
              <p className="mt-1 text-sm text-slate-400">Explain the amount you need. Approval happens from the admin payroll screen.</p>
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
                placeholder="Why do you need the advance?"
                disabled={submitting || Boolean(pendingRequest)}
                className="border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">Approved requests create an ordinary payroll deduction and do not change existing commission or payslip logic.</p>
              <Button type="button" variant="primary" onClick={submitRequest} disabled={submitting || Boolean(pendingRequest)}>
                {submitting ? "Submitting..." : "Submit request"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80">
          <h2 className="text-xl font-semibold text-white">Request history</h2>
          <p className="mt-1 text-sm text-slate-400">Track approval status and admin comments.</p>

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
                {row.adminComment ? (
                  <p className="mt-3 rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                    {row.adminComment}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
