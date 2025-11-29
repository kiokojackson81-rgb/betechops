"use client";
import React, { useEffect, useState } from "react";
import { formatISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

type MarketingSummary = any;

export default function SummaryPanelClient({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [summary, setSummary] = useState<MarketingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing-report/summary?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Status ${res.status}`);
      }
      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || String(err));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Quick summary</h2>
          <p className="text-xs text-slate-400">Choose a quick range to view aggregated metrics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const s = startOfDay(new Date());
              const e = endOfDay(new Date());
              setFrom(formatISO(s));
              setTo(formatISO(e));
            }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500"
          >
            Today
          </button>
          <button
            onClick={() => {
              const s = startOfWeek(new Date(), { weekStartsOn: 1 });
              const e = endOfWeek(new Date(), { weekStartsOn: 1 });
              setFrom(formatISO(startOfDay(s)));
              setTo(formatISO(endOfDay(e)));
            }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500"
          >
            This week
          </button>
          <button
            onClick={() => {
              const s = startOfMonth(new Date());
              const e = endOfMonth(new Date());
              setFrom(formatISO(startOfDay(s)));
              setTo(formatISO(endOfDay(e)));
            }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500"
          >
            This month
          </button>
        </div>
      </div>

      <div>
        {loading && <div className="text-sm text-slate-300">Loading summary…</div>}
        {error && <div className="text-sm text-rose-400">Error: {error}</div>}
        {!loading && !summary && !error && <div className="text-sm text-slate-400">No data</div>}
      </div>

      {summary && (
        <div className="grid gap-3 md:grid-cols-5 text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Period sales</div>
            <div className="text-xl font-semibold text-white">KES {Math.round(summary.totalSales).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Period profit</div>
            <div className="text-xl font-semibold text-white">{summary.totalProfit ? `KES ${Math.round(summary.totalProfit).toLocaleString()}` : "—"}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Items sold</div>
            <div className="text-xl font-semibold text-white">{(summary.totalItems || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">MPESA vs Cash</div>
            <div className="text-sm text-slate-200">
              MPESA KES {Math.round(summary.paymentStats?.totalSalesMpesa || 0).toLocaleString()}
              <br />
              Cash KES {Math.round(summary.paymentStats?.totalSalesCash || 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Commission (cumulative)</div>
            <div className="text-xl font-semibold text-white">KES {Math.round(summary.commission?.commission || 0).toLocaleString()}</div>
            <div className="text-xs text-emerald-300">
              {summary.commission?.tiersReached?.length ? `Tiers: ${summary.commission.tiersReached.join(", ")}` : "No tiers reached yet"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
