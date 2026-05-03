"use client";

import React from "react";

type Summary = {
  totalSales: number;
  totalProfit: number;
  totalCost: number;
  receiptsCount: number;
  itemsCount: number;
  hasCompleteCosts: boolean;
  awaitingPricingCount?: number;
};

export default function ReceiptsSummary({
  summary,
  loading,
  quickRange,
  onApplyQuickRange,
  rangeLabel,
  profitViewActive = false,
  onProfitClick,
}: {
  summary: Summary | null;
  loading: boolean;
  quickRange: "today" | "yesterday" | "this-week" | "custom" | "trading-period";
  onApplyQuickRange: (key: "today" | "yesterday" | "this-week" | "trading-period") => void;
  rangeLabel: string;
  profitViewActive?: boolean;
  onProfitClick?: () => void;
}) {

  const formatCurrency = (value: number) =>
    `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

  const salesLabel = loading ? "Loading..." : formatCurrency(summary?.totalSales ?? 0);
  const profitLabel = loading ? "Loading..." : formatCurrency(summary?.totalProfit ?? 0);
  const profitNote = loading
    ? ""
    : summary?.hasCompleteCosts
    ? "All priced receipts"
    : (summary?.awaitingPricingCount ? `${summary.awaitingPricingCount} awaiting pricing` : "Based on priced receipts only");

  const receiptsLabel = loading ? "Loading..." : String(summary?.receiptsCount ?? 0);
  const itemsLabel = loading ? "Loading..." : String(summary?.itemsCount ?? 0);

  return (
    <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Snapshot</p>
          <h2 className="text-lg font-semibold text-white">Receipt totals</h2>
          <p className="text-sm text-slate-400">
            Quick filters let you lock the view to today, this week, or this trading period while the list remains read-only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => onApplyQuickRange("today")}
            className={`rounded-full border px-3 py-1 transition ${
              quickRange === "today"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onApplyQuickRange("yesterday")}
            className={`rounded-full border px-3 py-1 transition ${
              quickRange === "yesterday"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
            }`}
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => onApplyQuickRange("this-week")}
            className={`rounded-full border px-3 py-1 transition ${
              quickRange === "this-week"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
            }`}
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => onApplyQuickRange("trading-period")}
            className={`rounded-full border px-3 py-1 transition ${
              quickRange === "trading-period"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
            }`}
          >
            This period
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total sales</p>
          <p className="text-xl font-semibold text-emerald-300">{salesLabel}</p>
        </div>
        <button
          type="button"
          onClick={onProfitClick}
          title={
            onProfitClick
              ? "Display the POS receipts whose priced buying costs contribute to this profit total."
              : undefined
          }
          className={`rounded-xl border bg-slate-950/40 px-3 py-2 text-left transition ${
            profitViewActive
              ? "border-emerald-500/60 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]"
              : "border-white/5 hover:border-emerald-500/40"
          }`}
        >
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total profit</p>
          <div>
            <p className={`text-xl font-semibold ${summary?.hasCompleteCosts ? "text-emerald-300" : "text-slate-400"}`}>
              {profitLabel}
            </p>
            {profitNote && (
              <p className="text-[11px] text-slate-400">{profitNote}</p>
            )}
            {onProfitClick && (
              <p className="text-[11px] text-emerald-300">
                {profitViewActive ? "Showing contributing POS receipts" : "Click to show contributing POS receipts"}
              </p>
            )}
          </div>
        </button>
        <div className="rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Receipts</p>
          <p className="text-xl font-semibold text-white">{receiptsLabel}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Products sold</p>
          <p className="text-xl font-semibold text-white">{itemsLabel}</p>
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-400">Range: <span className="font-semibold text-white">{rangeLabel}</span></div>
    </section>
  );
}
