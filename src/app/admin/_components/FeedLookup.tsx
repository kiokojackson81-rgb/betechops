"use client";

import { useState } from "react";

export default function FeedLookup() {
  const [feedId, setFeedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!feedId.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(`/api/jumia/feeds/${encodeURIComponent(feedId.trim())}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setResult(j);
    } catch (err) {
      setResult({ ok: false, error: (err as any)?.message || String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-white/10 p-3 bg-white/5">
      <form onSubmit={run} className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs mb-1">Feed ID</label>
          <input value={feedId} onChange={e=>setFeedId(e.target.value)} placeholder="fb53ce1d-6268-..." className="rounded bg-white/5 border border-white/10 px-3 py-1.5" />
        </div>
        <button disabled={busy} className="rounded border border-white/10 px-3 py-1.5 hover:bg-white/10">Lookup</button>
      </form>
      <div className="mt-3 text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
        {result ? JSON.stringify(result, null, 2) : <span className="text-slate-500">Result will appear here…</span>}
      </div>
    </div>
  );
}
