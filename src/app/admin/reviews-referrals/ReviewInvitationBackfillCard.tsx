"use client";

import { useState } from "react";

type BackfillSummary = {
  lookbackDays: number;
  windowStart: string;
  windowEnd: string;
  scannedOrders: number;
  createdInvitations: number;
  skippedInvitations: number;
  touchedOrders: number;
  dueProcessing: {
    scanned: number;
    sent: number;
    failed: number;
    skipped: number;
  } | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ReviewInvitationBackfillCard() {
  const [lookbackDays, setLookbackDays] = useState("7");
  const [loading, setLoading] = useState<"backfill" | "backfill-send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BackfillSummary | null>(null);

  async function runBackfill(mode: "backfill" | "backfill-send") {
    setLoading(mode);
    setError(null);

    try {
      const response = await fetch("/api/admin/reviews-referrals/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookbackDays: Number.parseInt(lookbackDays, 10) || 7,
          processDue: mode === "backfill-send",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        summary?: BackfillSummary;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.summary) {
        throw new Error(payload.error || "Unable to backfill recent sales.");
      }

      setSummary(payload.summary);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to backfill recent sales.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Recent Sales Backfill</div>
        <h2 className="text-3xl font-semibold tracking-tight text-white">Seed review invitations for recent orders</h2>
        <p className="max-w-3xl text-sm text-slate-400">
          Scan recent website and POS-synced sales, create any missing review invitations, and optionally process invitations that are already due for sending.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Lookback days</span>
          <input
            value={lookbackDays}
            onChange={(event) => setLookbackDays(event.target.value)}
            inputMode="numeric"
            className="w-32 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
          />
        </label>

        <button
          type="button"
          onClick={() => runBackfill("backfill")}
          disabled={loading !== null}
          className="inline-flex rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 disabled:opacity-60"
        >
          {loading === "backfill" ? "Running..." : "Backfill recent sales"}
        </button>

        <button
          type="button"
          onClick={() => runBackfill("backfill-send")}
          disabled={loading !== null}
          className="inline-flex rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/30 disabled:opacity-60"
        >
          {loading === "backfill-send" ? "Running..." : "Backfill and process due now"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Scanned orders</div>
            <div className="mt-3 text-2xl font-semibold text-white">{summary.scannedOrders}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Created invitations</div>
            <div className="mt-3 text-2xl font-semibold text-cyan-200">{summary.createdInvitations}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Skipped existing</div>
            <div className="mt-3 text-2xl font-semibold text-slate-100">{summary.skippedInvitations}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Due sent</div>
            <div className="mt-3 text-2xl font-semibold text-emerald-200">{summary.dueProcessing?.sent ?? 0}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Due failed</div>
            <div className="mt-3 text-2xl font-semibold text-rose-200">{summary.dueProcessing?.failed ?? 0}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Window</div>
            <div className="mt-3 text-sm font-medium text-slate-100">{summary.lookbackDays} days</div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/50 p-4 md:col-span-2 xl:col-span-6">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Last run</div>
            <div className="mt-2 text-sm text-slate-200">
              {formatDateTime(summary.windowStart)} to {formatDateTime(summary.windowEnd)}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
