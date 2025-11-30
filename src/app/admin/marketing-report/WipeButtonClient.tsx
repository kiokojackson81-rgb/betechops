"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog, showToast } from "@/lib/ui/toast";

export default function WipeButtonClient({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const wipe = async () => {
    const ok = await confirmDialog("This will delete all receipts and items for this day. Continue?");
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketing-report/update-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, action: 'wipe' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Wipe failed');
      }
      // refresh to reflect wiped state
      router.refresh();
      showToast('Wipe completed', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Wipe failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={wipe} disabled={loading} className="text-xs text-rose-400 underline hover:text-rose-300">
      {loading ? 'Working...' : 'Wipe'}
    </button>
  );
}
