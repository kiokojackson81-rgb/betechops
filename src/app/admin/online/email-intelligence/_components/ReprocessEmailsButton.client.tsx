"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function ReprocessEmailsButtonClient(props: { mailboxId: string; mailboxEmail: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/online/reprocess-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId: props.mailboxId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ? String(json.error) : `Reprocess failed (${res.status})`);
      }
      const s = json.summary;
      setLastResult(
        `reprocessed=${s.reprocessed} parsed=${s.parsed} failed=${s.failed} digests=${s.updatedDigests} returns=${s.updatedReturns} orders=${s.updatedOrders} afterSales=${s.updatedAfterSales}`,
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-full border border-sky-500/40 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Reprocessing…" : "Reprocess existing emails"}
      </button>
      {lastResult ? <span className="text-[11px] text-slate-300">{lastResult}</span> : null}
      {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
    </div>
  );
}

