"use client";

import Card from "@/app/_components/Card";
import type { ReactNode } from "react";

export type ShopSalesRow = {
  id: string;
  name: string;
  platform: string;
  country: string;
  currency: string;
  status: string;
  codeLabel: string;
  handlerName: string;
  handlerRole: string;
  periodLabel: string;
  totalSales: number;
};

export default function AssignedShopsCard({
  rows,
  loading,
  weekLabel,
}: {
  rows: ShopSalesRow[];
  loading: boolean;
  weekLabel: string;
}) {
  return (
    <Card className="space-y-3 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Marketplace Overview (Last week)</p>
          <h2 className="text-lg font-semibold">Assigned shops</h2>
        </div>
        <span className="text-xs text-slate-400">{weekLabel}</span>
      </div>

      <div className="space-y-3 text-sm">
        {loading && <p className="text-xs text-slate-400">Loading shops…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-xs text-slate-400">No assigned shops for this week.</p>
        )}
        {rows.map((shop) => (
          <div key={shop.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-100">{shop.name}</p>
              <span className="text-xs text-slate-400">{shop.platform}</span>
            </div>
            <p className="text-[11px] text-slate-400">{shop.codeLabel} • {shop.country} • {shop.currency}</p>
            <p className="text-[11px] text-slate-400">{shop.handlerName} • {shop.handlerRole}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
