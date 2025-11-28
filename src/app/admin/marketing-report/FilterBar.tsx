"use client";

import React, { useState } from "react";
import Button from "@/app/_components/Button";
import Input from "@/app/_components/Input";
import { useRouter } from "next/navigation";

type Props = {
  initialFrom?: string;
  initialTo?: string;
  initialDay?: string;
};

export default function MarketingReportFilterBar({ initialFrom = "", initialTo = "", initialDay = "" }: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [day, setDay] = useState(initialDay);
  const router = useRouter();

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (day) qs.set("dow", day);
    const url = `/admin/marketing-report${qs.toString() ? `?${qs.toString()}` : ""}`;
    router.push(url);
  };

  return (
    <form onSubmit={apply} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
      <div className="text-sm font-semibold text-slate-200">Filters</div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
          />
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
