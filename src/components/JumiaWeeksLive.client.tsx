"use client";
import React, { useEffect, useState } from "react";

type WeekPayload = {
  period: { start: string; end: string };
  label: string;
  _sum: { grossSales: number; payoutAmount: number };
  realRowCount: number;
  placeholderRowCount: number;
  accountCount: number;
  missingCount: number;
  totalRealPayout?: number;
  totalPlaceholderPayout?: number;
  displayPayout?: number;
};

export default function JumiaWeeksLive({ initialData, totalActiveAccounts }: { initialData: WeekPayload[]; totalActiveAccounts: number; }) {
  const [weeks, setWeeks] = useState<WeekPayload[]>(initialData ?? []);
  const [loading, setLoading] = useState(false);

  const currencyFormatter = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
  const numberFormatter = new Intl.NumberFormat("en-KE");

  useEffect(() => {
    let mounted = true;
    const fetchOnce = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/online/jumia-weeks`, { cache: "no-store", credentials: 'include' });
        if (!res.ok) {
          // don't overwrite existing data on auth errors or other failures
          return;
        }
        const json = await res.json();
        // debug: expose fetched payload in browser console for troubleshooting
        // eslint-disable-next-line no-console
        console.debug('[JumiaWeeksLive] fetched payload', json);
        // json.accounts -> array of accounts each with weeks[]; we need to aggregate per week across accounts
        const weeksMap = new Map<string, any>();
        for (const acc of json.accounts || []) {
          for (const w of acc.weeks || []) {
            const key = w.weekStart;
            const entry = weeksMap.get(key) ?? { label: w.weekStart + "", _sum: { grossSales: 0, payoutAmount: 0 }, realRowCount: 0, placeholderRowCount: 0, accountCount: 0, missingCount: 0 };
            entry._sum.grossSales += Number(w.grossSales || 0);
            entry._sum.payoutAmount += Number(w.payoutAmount || 0);
            if (w.placeholder) entry.placeholderRowCount += 1; else entry.realRowCount += 1;
            entry.accountCount += 1;
            weeksMap.set(key, entry);
          }
        }
        const mapped = Array.from(weeksMap.entries()).map(([k, v]) => ({ ...v, label: k }));
        mapped.sort((a: any, b: any) => (a.label < b.label ? 1 : -1));
        if (mounted && mapped.length) setWeeks(mapped.slice(0, 8));
      } catch (e) {
        // ignore - keep existing UI
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOnce();
    const id = setInterval(fetchOnce, 15000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {weeks.length ? (
          weeks.map((w: any) => {
            const gross = Number(w._sum?.grossSales ?? 0);
            const payout = Number(w._sum?.payoutAmount ?? 0);
            return (
              <a key={w.label} className="block rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 hover:bg-slate-900/50">
                <div className="text-sm text-slate-300">{w.label}</div>
                <div className="mt-2 text-xs text-slate-400">Accounts: <span className="font-semibold text-white">{totalActiveAccounts}</span> (Present {numberFormatter.format(w.realRowCount ?? w.accountCount ?? 0)} / Missing {numberFormatter.format(w.missingCount ?? 0)}) {w.placeholderRowCount ? (<span className="ml-2 text-xs text-slate-400">(Placeholders {numberFormatter.format(w.placeholderRowCount)})</span>) : null}</div>
                <div className="mt-1 text-sm text-emerald-300">Gross: {currencyFormatter.format(gross)}</div>
                <div className="text-sm text-emerald-200">Payout: {currencyFormatter.format(payout)}</div>
              </a>
            );
          })
        ) : (
          <div className="text-sm text-slate-400">No payout weeks found.</div>
        )}
      </div>
      {loading ? <div className="mt-2 text-xs text-slate-400">Refreshing...</div> : null}
    </>
  );
}
