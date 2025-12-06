"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Small helper to lock/unlock sensitive cards (values blurred when locked).
 * Unlock requires an authenticated session; otherwise the user is redirected to login.
 */
export function useCardLock(storageKey: string) {
  const { data: session } = useSession() as { data?: any } | undefined;
  const key = `lock:${storageKey}`;
  const [locked, setLocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, locked ? "1" : "0");
    } catch {
      // ignore
    }
  }, [key, locked]);

  const lock = () => setLocked(true);

  const unlock = () => {
    if (session) {
      setLocked(false);
      return;
    }
    if (typeof window !== "undefined") {
      const cb = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/attendant/login?callbackUrl=${cb}`;
    }
  };

  const toggle = () => (locked ? unlock() : lock());

  return { locked, lock, unlock, toggle };
}

export function LockButton({
  locked,
  onToggle,
  label,
}: {
  locked: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
      aria-pressed={!locked}
      title={locked ? "Unlock (login required)" : "Lock"}
    >
      <span aria-hidden>{locked ? "🔓" : "🔒"}</span>
      <span className="hidden sm:inline">{label ?? (locked ? "Unlock" : "Lock")}</span>
    </button>
  );
}
