"use client";

import React, { useMemo, useState } from "react";
import Button from "@/app/_components/Button";
import { useRouter } from "next/navigation";
import { getRecentTradingPeriods } from "@/lib/tradingPeriod";

type Props = {
  initialPeriod?: string;
  initialDay?: string;
};

export default function MarketingReportFilterBar({ initialPeriod = "", initialDay = "" }: Props) {
  const periods = useMemo(() => getRecentTradingPeriods(6), []);
  const defaultPeriodKey = initialPeriod || periods[0]?.key || "";
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey);
  const [day, setDay] = useState(initialDay);
  const router = useRouter();

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (periodKey) qs.set("period", periodKey);
    if (day) qs.set("dow", day);
    const url = `/admin/marketing-report${qs.toString() ? `?${qs.toString()}` : ""}`;
    router.push(url);
  };

  return (
    <form onSubmit={apply} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
      <div className="text-sm font-semibold text-slate-200">Filters</div>
      <div className="grid gap-3 md:grid-cols-3">
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
