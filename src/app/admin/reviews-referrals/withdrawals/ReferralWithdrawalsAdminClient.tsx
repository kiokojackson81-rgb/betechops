"use client";

import { useState } from "react";

type WithdrawalRow = {
  id: string;
  accountId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  method: string;
  phone: string;
  status: string;
  reference: string | null;
  reason: string | null;
  paidAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  availableBalance: number;
  paidWithdrawalAmount: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeClass(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "approved":
      return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
    case "held":
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    case "rejected":
      return "border-rose-400/20 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-200";
  }
}

export default function ReferralWithdrawalsAdminClient({ rows }: { rows: WithdrawalRow[] }) {
  const [localRows, setLocalRows] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [referenceById, setReferenceById] = useState<Record<string, string>>({});
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  async function updateStatus(id: string, status: "approved" | "paid" | "rejected" | "held") {
    const reference = referenceById[id]?.trim() || null;
    const reason = reasonById[id]?.trim() || null;
    if (status === "paid" && !reference) {
      window.alert("Enter the payment reference before marking this withdrawal as paid.");
      return;
    }
    if (status === "rejected" && !reason) {
      window.alert("Enter a rejection reason before rejecting this withdrawal.");
      return;
    }

    setBusy(`${id}:${status}`);
    const response = await fetch(`/api/admin/reviews-referrals/withdrawals/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reference, reason }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      withdrawal?: Partial<WithdrawalRow>;
      error?: string;
    };
    setBusy(null);

    if (!response.ok || !payload.ok || !payload.withdrawal) {
      window.alert(payload.error || "Unable to update withdrawal.");
      return;
    }
    const withdrawal = payload.withdrawal;

    setLocalRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...withdrawal,
              status: String(withdrawal.status || row.status),
              reference: withdrawal.reference ?? row.reference,
              reason: withdrawal.reason ?? row.reason,
              paidAt: withdrawal.paidAt ?? row.paidAt,
              updatedAt: withdrawal.updatedAt ?? row.updatedAt,
            }
          : row,
      ),
    );
    if (status === "paid") {
      setReferenceById((current) => ({ ...current, [id]: "" }));
    }
    if (status === "rejected") {
      setReasonById((current) => ({ ...current, [id]: "" }));
    }
  }

  if (!localRows.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No withdrawal requests yet.</div>
        <div className="mt-2 text-sm text-slate-400">Customer withdrawal requests will appear here after verified referral accounts submit them.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localRows.map((row) => (
        <article key={row.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">{row.customerName}</h2>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClass(row.status)}`}>
                  {row.status}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <div>Customer phone: {row.customerPhone}</div>
                <div>Payout phone: {row.phone}</div>
                <div>Requested: {formatDate(row.createdAt)}</div>
                <div>Paid at: {formatDate(row.paidAt)}</div>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Withdrawal amount</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-white">{formatMoney(row.amount)}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Method</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{row.method.replace(/_/g, " ")}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Available balance now</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{formatMoney(row.availableBalance)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Paid withdrawals total</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{formatMoney(row.paidWithdrawalAmount)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Reference</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{row.reference || "Pending"}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Payment reference</span>
              <input
                value={referenceById[row.id] ?? row.reference ?? ""}
                onChange={(event) => setReferenceById((current) => ({ ...current, [row.id]: event.target.value }))}
                placeholder="M-Pesa code"
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/35"
              />
            </label>
            <label className="grid gap-2 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Reason or hold note</span>
              <input
                value={reasonById[row.id] ?? row.reason ?? ""}
                onChange={(event) => setReasonById((current) => ({ ...current, [row.id]: event.target.value }))}
                placeholder="Internal note or rejection reason"
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/35"
              />
            </label>
          </div>

          {row.reason ? <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{row.reason}</div> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => updateStatus(row.id, "approved")}
              disabled={busy !== null}
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy === `${row.id}:approved` ? "Updating..." : "Approve"}
            </button>
            <button
              onClick={() => updateStatus(row.id, "held")}
              disabled={busy !== null}
              className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy === `${row.id}:held` ? "Updating..." : "Hold"}
            </button>
            <button
              onClick={() => updateStatus(row.id, "paid")}
              disabled={busy !== null}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy === `${row.id}:paid` ? "Updating..." : "Mark paid"}
            </button>
            <button
              onClick={() => updateStatus(row.id, "rejected")}
              disabled={busy !== null}
              className="rounded-2xl bg-rose-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy === `${row.id}:rejected` ? "Updating..." : "Reject"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
