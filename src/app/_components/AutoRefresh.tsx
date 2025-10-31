"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ intervalMs = 60000, storageKey = "autoRefreshEnabled", defaultEnabled = true, eventName = 'orders:refresh' }: { intervalMs?: number; storageKey?: string; defaultEnabled?: boolean; eventName?: string }) {
  const router = useRouter();
  const timer = useRef<NodeJS.Timeout | null>(null);
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(storageKey);
      return v === null ? defaultEnabled : v === "1";
    } catch {
      return defaultEnabled;
    }
  });

  useEffect(() => {
    if (enabled) {
      timer.current = setInterval(() => {
        try {
          const detail = { source: 'timer', ts: Date.now() } as const;
          window.dispatchEvent(new CustomEvent(eventName, { detail }));
        } catch {}
      }, Math.max(5000, intervalMs));
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [enabled, intervalMs, router, eventName]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, enabled ? "1" : "0"); } catch {}
  }, [enabled, storageKey]);

  return (
    <div className="text-xs text-slate-400 flex items-center gap-2">
      <span>Auto-refresh</span>
      <button onClick={() => setEnabled((v) => !v)} className="px-2 py-0.5 rounded border border-white/10 hover:bg-white/10">
        {enabled ? "On" : "Off"}
      </button>
      <span className="opacity-60">{Math.round(intervalMs/1000)}s</span>
    </div>
  );
}
