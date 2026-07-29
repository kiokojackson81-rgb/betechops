"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/ui/toast";

export default function OperatingCapitalAdminCard(props: {
  weekStart: string;
  periodKey: string;
  accountId?: string | null;
  canFinalize: boolean;
  isFinal: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "finalize" | "reopen">("");

  const runAction = async (mode: "finalize" | "reopen") => {
    setBusy(mode);
    try {
      const res = await fetch(`/api/admin/online/operating-capital/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: props.weekStart,
          periodKey: props.periodKey,
          accountId: props.accountId ?? null,
        }),
      });
      const body = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(String(body?.error ?? `Failed to ${mode} operating capital`));
      showToast(mode === "finalize" ? "Operating capital finalized" : "Operating capital reopened", "success");
      startTransition(() => router.refresh());
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${mode} operating capital`, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Operating capital controls</h2>
          <p className="text-sm text-slate-400">
            Final operating capital is frozen until an admin explicitly reopens or recalculates it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runAction("finalize")}
            disabled={busy !== "" || !props.canFinalize}
            className="rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {busy === "finalize" ? "Saving..." : props.isFinal ? "Recalculate final" : "Finalize now"}
          </button>
          <button
            type="button"
            onClick={() => void runAction("reopen")}
            disabled={busy !== "" || !props.isFinal}
            className="rounded-full border border-amber-400/50 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
          >
            {busy === "reopen" ? "Reopening..." : "Reopen final"}
          </button>
        </div>
      </div>
    </section>
  );
}
