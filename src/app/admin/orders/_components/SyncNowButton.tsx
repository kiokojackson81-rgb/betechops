"use client";

import { useState } from "react";

export default function SyncNowButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setMsg("Running incremental sync…");
    try {
      const incrementalRes = await fetch("/api/jumia/jobs/sync-incremental?lookbackDays=3", { method: "POST" });
      if (!incrementalRes.ok) throw new Error(`incremental sync failed: ${incrementalRes.status}`);
      setMsg("Incremental sync completed. Refreshing KPIs…");

      try {
        await fetch("/api/metrics/kpis/refresh", { method: "POST" });
      } catch {}
      setMsg("Done. Reloading.");
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(m);
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-md bg-slate-800/60 border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
        title="Run incremental sync now"
      >
        {busy ? "Syncing." : "Sync now"}
      </button>
      {msg && <span className="ml-2 text-xs text-slate-400">{msg}</span>}
    </div>
  );
}
