"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Props = {
  value: number | string;
  format?: (v: number | string) => string;
  storageKey?: string; // optional key to persist hidden state per-field
  placeholder?: string;
  className?: string;
};

export default function SensitiveValue({
  value,
  format,
  storageKey,
  placeholder = "••••",
  className = "",
}: Props) {
  const _sess = useSession() as { data?: any } | undefined;
  const session = _sess?.data;

  const key = typeof storageKey === "string" && storageKey.length > 0
    ? `sensitive:${storageKey}`
    : typeof window !== "undefined"
    ? `sensitive:${window.location.pathname}:${String(value).slice(0, 40)}`
    : `sensitive:unknown`;

  const [visible, setVisible] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      const raw = localStorage.getItem(key);
      const val = raw === "1";
      console.debug("SensitiveValue:init", { key, stored: raw, visible: val });
      return val;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, visible ? "1" : "0");
    } catch {
      // ignore
    }
  }, [key, visible]);

  const onToggle = () => {
    if (visible) {
      setVisible(false);
      console.debug("SensitiveValue:hide", { key });
      return;
    }
    // require login to unhide
    if (session) {
      setVisible(true);
      console.debug("SensitiveValue:unhide (session present)", { key });
      return;
    }
    console.debug("SensitiveValue:redirecting to login (no session)", { key });
    // Not logged in: redirect to login with callbackUrl
    if (typeof window !== "undefined") {
      const cb = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/attendant/login?callbackUrl=${cb}`;
    }
  };

  const formatted = format ? format(value) : String(value);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded ${className} cursor-pointer`}
      aria-pressed={visible}
      aria-label={visible ? "Hide value" : "Show value (login required)"}
      title={visible ? "Hide value" : "Click to show (login required)"}
    >
      {visible ? (
        <span className="select-none pointer-events-auto">{formatted}</span>
      ) : (
        <span className="inline-flex items-center gap-2 pointer-events-auto">
          <span className="blur-sm opacity-60 select-none">{formatted}</span>
          <span aria-hidden className="text-xs text-slate-400">🔒</span>
        </span>
      )}
    </button>
  );
}
