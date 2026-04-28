"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "admin-dashboard-privacy-hidden";

export default function AdminPrivacyToggle() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      const nextHidden = window.localStorage.getItem(STORAGE_KEY) === "1";
      setHidden(nextHidden);
      document.documentElement.dataset.adminSensitiveHidden = nextHidden ? "true" : "false";
    } catch {
      document.documentElement.dataset.adminSensitiveHidden = "false";
    }
  }, []);

  const toggle = () => {
    setHidden((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      document.documentElement.dataset.adminSensitiveHidden = next ? "true" : "false";
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200"
      aria-pressed={hidden}
      aria-label={hidden ? "Show dashboard figures" : "Hide dashboard figures"}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {hidden ? "Show figures" : "Hide figures"}
    </button>
  );
}
