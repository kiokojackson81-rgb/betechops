"use client";
import React, { useState } from "react";

export default function UndoLastWipeClient({ lastWipeId }: { lastWipeId?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUndo = async () => {
    if (!lastWipeId) {
      setError("No wipe action found to undo");
      return;
    }
    const ok = window.confirm("Undo the most recent wipe? This will attempt to restore receipts/items for that day.");
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/action-logs/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionLogId: lastWipeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to undo last wipe");
      setDone(true);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Undo failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleUndo} disabled={loading || !lastWipeId} className="rounded px-3 py-1 bg-amber-500 text-black text-sm">
        {loading ? "Undoing..." : "Undo last wipe"}
      </button>
      {done && <span className="text-emerald-300 ml-2">Done</span>}
      {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}
    </div>
  );
}
