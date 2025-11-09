"use client";

import { useEffect, useState } from "react";
import toast from "@/lib/toast";

type UploadActivity = {
  id: string;
  intValue?: number | null;
  entryDate: string;
  notes?: string | null;
  category?: string | null;
};

function formatDate(input: string) {
  const d = new Date(input);
  if (!Number.isFinite(d.valueOf())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProductUploadsCard() {
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<UploadActivity[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/attendants/activities?metric=PRODUCT_UPLOADS&take=7", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as UploadActivity[];
      setHistory(data);
    } catch {
      // ignore network errors for history
    }
  }

  async function submit() {
    const value = Number(count);
    if (!Number.isInteger(value) || value <= 0) {
      toast("Enter how many products you uploaded", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendants/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric: "PRODUCT_UPLOADS",
          intValue: value,
          notes: notes.trim() ? notes.trim() : undefined,
          category: "PRODUCT_UPLOAD",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save uploads");
      }
      toast("Upload count saved", "success");
      setCount("");
      setNotes("");
      await fetchHistory();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setBusy(false);
    }
  }

  const total = history.reduce((acc, row) => acc + (row.intValue ?? 0), 0);

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(9,33,38,.95),rgba(9,33,38,.75))] p-4 shadow-lg shadow-cyan-900/30">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Product Upload Tracker</h2>
          <p className="text-xs text-slate-300">Record catalogue uploads so that QA and finance can reconcile the workload.</p>
        </div>
        <div className="text-right text-xs text-cyan-200">
          <div>Total logged</div>
          <div className="text-base font-semibold">{total}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400">Products uploaded</label>
          <input
            value={count}
            onChange={(e) => setCount(e.target.value)}
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 18"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          />
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="self-end rounded-lg bg-cyan-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 focus:outline-none disabled:opacity-50"
        >
          {busy ? "Saving..." : "Log uploads"}
        </button>
      </div>

      <div className="mt-3">
        <label className="text-xs uppercase tracking-widest text-slate-400">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Optional: account/channel or next steps"
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
        />
      </div>

      <div className="mt-4">
        <h3 className="text-xs uppercase tracking-widest text-slate-400">Last submissions</h3>
        <ul className="mt-2 space-y-2">
          {history.map((row) => (
            <li key={row.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <div>
                <div className="text-white">
                  <span className="text-lg font-semibold">{row.intValue ?? 0}</span> products
                </div>
                {row.notes ? <div className="text-xs text-slate-400">{row.notes}</div> : null}
              </div>
              <div className="text-xs text-slate-400">{formatDate(row.entryDate)}</div>
            </li>
          ))}
          {!history.length && (
            <li className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">No uploads logged yet</li>
          )}
        </ul>
      </div>
    </section>
  );
}
