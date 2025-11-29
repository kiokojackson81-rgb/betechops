"use client";
import React, { useState } from "react";

export default function RestoreButtonClient({ actionLogId }: { actionLogId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    const ok = window.confirm("Restore receipts from this action log? This will re-insert receipts/items for the day.");
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/action-logs/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionLogId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to restore");
      setDone(true);
      // reload to reflect restored data
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Restore failed");
    } finally {
      setLoading(false);
    }
  };

  if (done) return <span className="text-emerald-300">Restored</span>;

  return (
    <div>
      <button onClick={handleRestore} disabled={loading} className="text-xs rounded px-2 py-1 bg-emerald-600 text-black">
        {loading ? "Restoring..." : "Restore"}
      </button>
      {error && <div className="text-rose-400 text-xs mt-1">{error}</div>}
    </div>
  );
}
