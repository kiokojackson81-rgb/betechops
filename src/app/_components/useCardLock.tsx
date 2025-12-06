"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Small helper to lock/unlock sensitive cards (values blurred when locked).
 * Unlock requires an authenticated session; otherwise the user is redirected to login.
 */
export function useCardLock(storageKey: string) {
  const sessionResult = useSession();
  const session = (sessionResult as any)?.data;
  const status = (sessionResult as any)?.status;
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
    // If session still loading, optimistically unlock and let downstream values render.
    if (status === "loading") {
      setLocked(false);
      return;
    }

    // If we have a session object OR status explicitly says authenticated, unlock locally
    if (session || status === "authenticated") {
      setLocked(false);
      return;
    }

    // If explicitly unauthenticated, unlock and redirect to login so numbers show after login redirect back.
    if (status === "unauthenticated") {
      setLocked(false);
      if (typeof window !== "undefined") {
        const cb = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/attendant/login?callbackUrl=${cb}`;
      }
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
