"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function WipeAllButtonClient({ userId, periodKey }: { userId: string; periodKey?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const wipeAll = async () => {
    const ok = window.confirm("This will delete receipts for all entries submitted by this attendant in the selected period. Continue?");
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketing-report/wipe-by-attendant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tradingPeriodKey: periodKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Wipe failed');
      alert(`Wiped ${j.wiped || 0} entries (batch ${j.batchId || ''})`);
      router.refresh();
    } catch (err: any) {
      alert(err?.message || 'Wipe failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={wipeAll} disabled={loading} className="text-xs text-rose-400 underline hover:text-rose-300">
      {loading ? 'Working...' : 'Wipe all by attendant'}
    </button>
  );
}
