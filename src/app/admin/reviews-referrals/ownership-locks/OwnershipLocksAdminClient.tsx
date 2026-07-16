"use client";

import { useState } from "react";

type LockRow = {
  id: string;
  normalizedPhone: string;
  status: string;
  source: string;
  ownerType: string;
  ownerUserId: string | null;
  ownerReferralAccountId: string | null;
  customerUserId: string | null;
  customerName: string | null;
  productName: string | null;
  agentLeadId: string | null;
  reviewId: string | null;
  referralLinkId: string | null;
  lockExpiresAt: string | null;
  releasedAt: string | null;
  overrideNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OwnershipLocksAdminClient({ initialRows }: { initialRows: LockRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function releaseLock(id: string) {
    const note = String(notes[id] || "").trim();
    if (note.length < 5) {
      window.alert("Enter a short override note before releasing the lock.");
      return;
    }
    setBusyId(id);
    const response = await fetch(`/api/admin/reviews-referrals/ownership-locks/${id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      lock?: LockRow | null;
    };
    setBusyId(null);
    if (!response.ok || !payload.ok || !payload.lock) {
      window.alert(payload.error || "Unable to release referral lock.");
      return;
    }
    setRows((current) => current.map((row) => (row.id === id ? payload.lock! : row)));
  }

  return (
    <div className="space-y-4">
      {!rows.length ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
          <div className="text-lg font-semibold text-white">No referral ownership locks found.</div>
        </div>
      ) : null}

      {rows.map((row) => (
        <article key={row.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">{row.customerName || "Referred customer"}</h2>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${row.status === "active" ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
                  {row.status}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <div>Phone: {row.normalizedPhone}</div>
                <div>Source: {row.source}</div>
                <div>Owner type: {row.ownerType}</div>
                <div>Product: {row.productName || "Not captured"}</div>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Lock expires</div>
              <div className="mt-2 text-sm font-semibold text-white">{formatDate(row.lockExpiresAt)}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Created</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.createdAt)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Referral link</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{row.referralLinkId || "Not linked"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Released</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.releasedAt)}</div>
            </div>
          </div>

          {row.status === "active" ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
              <textarea
                value={notes[row.id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                rows={3}
                placeholder="Explain why this ownership lock is being released"
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              />
              <button
                onClick={() => releaseLock(row.id)}
                disabled={busyId !== null}
                className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 disabled:opacity-60"
              >
                {busyId === row.id ? "Releasing..." : "Release lock"}
              </button>
            </div>
          ) : row.overrideNote ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {row.overrideNote}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
