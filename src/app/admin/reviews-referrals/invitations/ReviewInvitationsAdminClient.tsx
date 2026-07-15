"use client";

import { useMemo, useState } from "react";

type InvitationRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  reviewStatus: string;
  scheduledSendAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  sendAttempts: number;
  lastSendAttemptAt: string | null;
  lastSendStatus: string | null;
  lastSendError: string | null;
  websiteOrderId: string | null;
  orderId: string | null;
  receiptId: string | null;
  orderOrReceiptRef: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function badgeClass(status: string) {
  if (status === "sent") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "failed") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (status === "due") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function deriveQueue(row: InvitationRow) {
  if (row.sentAt) return "sent";
  if ((row.lastSendStatus || "").toUpperCase() === "FAILED") return "failed";
  return "due";
}

export default function ReviewInvitationsAdminClient({
  initialRows,
  initialFilter = "all",
}: {
  initialRows: InvitationRow[];
  initialFilter?: "all" | "due" | "sent" | "failed";
}) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<"all" | "due" | "sent" | "failed">(initialFilter);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredRows = useMemo(
    () => rows.filter((row) => filter === "all" || deriveQueue(row) === filter),
    [rows, filter],
  );

  async function retrySend(id: string) {
    setBusyId(id);
    const response = await fetch(`/api/admin/reviews-referrals/invitations/${id}/retry`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      invitation?: InvitationRow | null;
      error?: string;
    };
    setBusyId(null);
    if (!response.ok || !payload.ok || !payload.invitation) {
      window.alert(payload.error || "Unable to retry invitation send.");
      return;
    }
    setRows((current) => current.map((row) => (row.id === id ? payload.invitation! : row)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "due", "failed", "sent"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              filter === option
                ? "bg-cyan-300 text-slate-950"
                : "border border-white/10 bg-slate-950/60 text-slate-200"
            }`}
          >
            {option === "all" ? "All" : option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      {!filteredRows.length ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
          <div className="text-lg font-semibold text-white">No invitations in this queue.</div>
        </div>
      ) : null}

      {filteredRows.map((row) => {
        const queue = deriveQueue(row);
        return (
          <article key={row.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white">{row.customerName}</h2>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClass(queue)}`}>
                    {queue}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                  <div>Product: {row.productName}</div>
                  <div>Phone: {row.customerPhone}</div>
                  <div>Order/receipt: {row.orderOrReceiptRef || "Not linked"}</div>
                  <div>Review status: {row.reviewStatus}</div>
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Attempts</div>
                <div className="mt-2 text-2xl font-black tracking-tight text-white">{row.sendAttempts}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Scheduled</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.scheduledSendAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last attempt</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.lastSendAttemptAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sent at</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.sentAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Expires</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.expiresAt)}</div>
              </div>
            </div>

            {row.lastSendError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {row.lastSendError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => retrySend(row.id)}
                disabled={busyId !== null || queue === "sent"}
                className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busyId === row.id ? "Sending..." : queue === "sent" ? "Already sent" : queue === "failed" ? "Retry send" : "Send invitation"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
