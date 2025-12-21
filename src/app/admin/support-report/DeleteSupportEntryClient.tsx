"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog, showToast } from "@/lib/ui/toast";

type Props = {
  entryId: string;
  entry?: any;
  onDeleted?: (id: string) => void;
  onRestore?: (entry: any) => void;
  optimistic?: boolean;
};

export default function DeleteSupportEntryClient({ entryId, entry, onDeleted, onRestore, optimistic = true }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const remove = async () => {
    const ok = await confirmDialog("This will permanently delete the entire entry (including receipts). Continue?");
    if (!ok) return;

    if (optimistic && onDeleted) {
      try {
        onDeleted(entryId);
      } catch (e) {
        // ignore
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/support-report/delete-entry", {
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

      if (!optimistic && onDeleted) {
        try {
          onDeleted(entryId);
        } catch (e) {
          // swallow
        }
      }

      if (!optimistic && !onDeleted) {
        router.refresh();
      }
    } catch (err: any) {
      showToast(err?.message || "Delete failed", "error");
      if (optimistic && onRestore && entry) {
        try {
          onRestore(entry);
        } catch (e) {
          // swallow
        }
      } else if (optimistic && !onRestore) {
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
