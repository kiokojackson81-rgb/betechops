"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function KpisRefresher({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle"|"running"|"done"|"error">("idle");
  const once = useRef(false);
  useEffect(() => {
    if (!enabled || once.current) return;
    once.current = true;
    const last = Number(localStorage.getItem("kpisRefreshAt") || 0);
    if (Date.now() - last < 10 * 60_000) return; // only once every 10 minutes per browser
    (async () => {
      try {
        setStatus("running");
        const r = await fetch("/api/metrics/kpis/refresh", { method: "POST" });
        if (!r.ok) throw new Error("refresh failed");
        localStorage.setItem("kpisRefreshAt", String(Date.now()));
        setStatus("done");
        setTimeout(() => router.refresh(), 1500);
      } catch {
        setStatus("error");
      }
    })();
  }, [enabled, router]);

  if (!enabled) return null;
  return (
    <div className="text-xs text-slate-400">
      {status === "running" && <span>Recomputing exact totals…</span>}
      {status === "error" && <span>Exact totals refresh failed.</span>}
    </div>
  );
}
