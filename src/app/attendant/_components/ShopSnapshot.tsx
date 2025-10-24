"use client";

import { useEffect, useState } from "react";
import Link from 'next/link';

type Snap = { revenueToday: number; ordersToday: number; avgOrder: number; lowStockCount: number; openReturns: number };

export default function ShopSnapshot({ shopId }: { shopId?: string }) {
  const [data, setData] = useState<Snap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const u = new URL("/api/reports/today", window.location.origin);
        if (shopId) u.searchParams.set("shopId", shopId);
        const r = await fetch(u.toString(), { cache: "no-store" });
        if (!r.ok) throw new Error();
        const j = (await r.json()) as Snap;
        if (!ignore) setData(j);
      } catch {
        if (!ignore) setData({ revenueToday: 0, ordersToday: 0, avgOrder: 0, lowStockCount: 0, openReturns: 0 });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [shopId]);

  const n = (v: number) => new Intl.NumberFormat().format(v);
  const money = (v: number) => `KES ${n(v)}`;

  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur">
      <h2 className="mb-3 text-lg font-semibold">Shop Snapshot</h2>

      {loading && <div className="h-24 animate-pulse rounded-xl bg-white/5" />}

      {!loading && data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile label="Today’s Revenue" value={money(data.revenueToday)} />
          <Tile label="Orders Processed" value={n(data.ordersToday)} />
          <Tile label="Avg Order Value" value={money(data.avgOrder)} />
          <Tile label="Low Stock Items" value={<Link href="/attendant/stock-low" className="underline underline-offset-2">{n(data.lowStockCount)}</Link>} />
          <Tile label="Open Returns" value={<Link href="/attendant/returns" className="underline underline-offset-2">{n(data.openReturns)}</Link>} />
        </div>
      )}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b0e13] p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
