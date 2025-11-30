"use client";

import React, { useState } from "react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MultiDayExportClient({ periodKey, userFilter }: { periodKey?: string; userFilter?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    days.forEach((d) => (s[d] = false));
    return s;
  });

  const toggle = (d: string) => setSelected((p) => ({ ...p, [d]: !p[d] }));

  const exportCsv = () => {
    const picked = days.filter((d) => selected[d]);
    if (!picked.length) return;
    const params = new URLSearchParams();
    if (periodKey) params.set("period", periodKey);
    if (userFilter) params.set("user", userFilter);
    params.set("dows", picked.join(","));
    const url = `/api/admin/marketing-report/export-period?${params.toString()}`;
    window.open(url, "_blank");
    setOpen(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500"
      >
        Export selected days
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <h3 className="text-lg font-semibold">Export selected days</h3>
            <p className="text-sm text-slate-400">Choose which weekdays to include in the export.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {days.map((d) => (
                <label key={d} className="flex items-center gap-2">
                  <input type="checkbox" checked={selected[d]} onChange={() => toggle(d)} />
                  <span className="text-sm">{d}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm text-black" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
