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
      return raw === "1";
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
      return;
    }
    // require login to unhide
    if (session) {
      setVisible(true);
      return;
    }
    // Not logged in: redirect to login with callbackUrl
    if (typeof window !== "undefined") {
      const cb = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/attendant/login?callbackUrl=${cb}`;
    }
  };

  const display = visible ? (format ? format(value) : String(value)) : placeholder;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-2 focus:outline-none ${className}`}
      aria-pressed={visible}
      title={visible ? "Hide value" : "Click to show (login required)"}
    >
      <span>{display}</span>
    </button>
  );
}
