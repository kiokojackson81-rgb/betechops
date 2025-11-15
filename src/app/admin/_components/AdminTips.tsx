"use client";
import React, { useEffect, useState } from "react";

const TIPS = [
  "Use Shops & Staff to add Jumia/Kilimall shops + assign staff.",
  "Orders → Pending/RTS/Delivered filters are one click away.",
  "Catalog → price/stock/status feeds & feed history.",
];

export default function AdminTips() {
  const [dismissed, setDismissed] = useState<boolean>(false);
  useEffect(() => { setDismissed(localStorage.getItem("adminTipsDismissed") === "1"); }, []);
  function hide() { localStorage.setItem("adminTipsDismissed", "1"); setDismissed(true); }
  if (dismissed) return null;
  return (
    <div className="mt-8 grid gap-3 md:grid-cols-3">
      {TIPS.map(t => (
        <div key={t} className="relative rounded-xl bg-[var(--card,#171b23)] border border-white/10 p-4 text-xs md:text-sm">
          <p className="pr-6 leading-relaxed text-slate-300">{t}</p>
        </div>
      ))}
      <button
        aria-label="Dismiss tips"
        onClick={hide}
        className="absolute -mt-5 right-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 hover:text-white"
      >
        Dismiss ×
      </button>
    </div>
  );
}
