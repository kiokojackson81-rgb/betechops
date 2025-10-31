"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CountsRefreshButton({ shopId, exact }: { shopId: string; exact: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isAll = !shopId || shopId.toUpperCase() === "ALL";
  const qs = new URLSearchParams();
  if (isAll) qs.set("all", "true"); else qs.set("shopId", shopId);
  // Force an exact recompute and bypass cache read; route will still write the refreshed exact result into cache
  qs.set("exact", "true");
  qs.set("force", "true");

  return (
    <button
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          const res = await fetch(`/api/catalog/products-count?${qs.toString()}`, { cache: "no-store" });
          // Successful call warms Redis cache; refresh the page to reflect updated counts
          if (!res.ok) throw new Error("counts refresh failed");
        } catch {
          // ignore
        } finally {
          setLoading(false);
          try { window.dispatchEvent(new Event("catalog:counts:refresh")); } catch {}
        }
      }}
      className={`rounded border px-3 py-1 text-xs ${
        loading ? "border-white/10 bg-white/10 text-slate-300" : "border-white/15 bg-white/5 text-slate-100 hover:border-white/25"
      }`}
      title="Refresh counts now"
    >
      {loading ? "Refreshing…" : "Refresh counts"}
    </button>
  );
}
