"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog, showToast } from "@/lib/ui/toast";
import type { MarketingReportEntry } from "@/lib/marketingReport";

type Props = {
  entryId: string;
  entry?: MarketingReportEntry;
  onDeleted?: (id: string) => void; // called when entry should be removed from parent list
  onRestore?: (entry: MarketingReportEntry) => void; // called to restore an optimistically-removed entry on failure
  optimistic?: boolean; // default true
};

export default function DeleteEntryClient({ entryId, entry, onDeleted, onRestore, optimistic = true }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const remove = async () => {
    const ok = await confirmDialog("This will permanently delete the entire entry (including receipts). Continue?");
    if (!ok) return;

    // If optimistic removal is enabled, remove from parent immediately
    if (optimistic && onDeleted) {
      onDeleted(entryId);
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing-report/delete-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Delete failed");
      }

      showToast("Entry deleted", "success");

      // If not optimistic or parent expects confirmation callback, ensure onDeleted is called.
      if (!optimistic && onDeleted) {
        onDeleted(entryId);
      }

      // fallback: if no optimistic handler provided, refresh to update data
      if (!optimistic && !onDeleted) {
        router.refresh();
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
      // rollback optimistic removal if provided
      if (optimistic && onRestore && entry) {
        onRestore(entry);
      } else if (optimistic && !onRestore) {
        // no rollback handler: refresh to restore data from server
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={remove} disabled={loading} className="text-xs text-rose-400 underline hover:text-rose-300">
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
