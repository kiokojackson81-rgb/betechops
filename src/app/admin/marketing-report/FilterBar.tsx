"use client";

import React, { useMemo, useState, useEffect } from "react";
import Button from "@/app/_components/Button";
import { useRouter } from "next/navigation";
import { getRecentTradingPeriods } from "@/lib/tradingPeriod";

type Props = {
  initialPeriod?: string;
  initialDay?: string;
  initialDate?: string;
};

export default function MarketingReportFilterBar({ initialPeriod = "", initialDay = "", initialDate = "" }: Props) {
  const periods = useMemo(() => getRecentTradingPeriods(6), []);
  const defaultPeriodKey = initialPeriod || periods[0]?.key || "";
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey);
  const [day, setDay] = useState(initialDay);
  const [date, setDate] = useState<string | undefined>(initialDate || undefined);
  const router = useRouter();

  useEffect(() => {
    // When the period changes, clear the date if it's out of range
    if (!date) return;
    const p = periods.find((p) => p.key === periodKey);
    if (!p) return;
    if (date < p.start || date > p.end) {
      setDate(undefined);
    }
  }, [periodKey]);

  const deriveDayOfWeek = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dow = map[d.getDay()];
      // app supports Monday-Saturday only; return empty for Sunday
      if (dow === "Sunday") return "";
      return dow;
    } catch {
      return "";
    }
  };

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (periodKey) qs.set("period", periodKey);
    if (day) qs.set("dow", day);
    if (date) qs.set("date", date);
    const url = `/admin/marketing-report${qs.toString() ? `?${qs.toString()}` : ""}`;
    router.push(url);
  };

  return (
    <form onSubmit={apply} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
      <div className="text-sm font-semibold text-slate-200">Filters</div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Trading period</label>
          <select
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
          >
            {periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date ?? ""}
              onChange={(e) => {
                const v = e.target.value || undefined;
                setDate(v);
                if (v) setDay(deriveDayOfWeek(v));
              }}
              min={periods.find((p) => p.key === periodKey)?.start}
              max={periods.find((p) => p.key === periodKey)?.end}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
            />
            {date ? (
              <button
                type="button"
                aria-label="Clear date"
                onClick={() => {
                  setDate(undefined);
                  setDay("");
                }}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
          >
            <option value="">All days</option>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="primary" className="w-full justify-center">
            Apply filters
          </Button>
        </div>
      </div>
    </form>
  );
}
