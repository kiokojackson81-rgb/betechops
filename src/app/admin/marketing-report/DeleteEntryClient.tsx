"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog, showToast } from "@/lib/ui/toast";

export default function DeleteEntryClient({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const remove = async () => {
    const ok = await confirmDialog("This will permanently delete the entire entry (including receipts). Continue?");
    if (!ok) return;
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
      router.refresh();
    } catch (err: any) {
      showToast(err?.message || "Delete failed", "error");
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
