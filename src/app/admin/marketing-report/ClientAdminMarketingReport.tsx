"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import ProgressBar from "@/app/_components/ProgressBar";
import MarketingReportFilterBar from "./FilterBar";
import MultiDayExportClient from "./MultiDayExportClient";
import type { MarketingReportEntry, MarketingReportAggregates } from "@/lib/marketingReport";

const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

const dayLabels = ["All days", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatKES = (value: number) => `KES ${Math.round(value).toLocaleString("en-KE")}`;

type Props = {
  entries?: MarketingReportEntry[];
  aggregates?: MarketingReportAggregates;
  selectedPeriodKey?: string;
  dow?: string;
  dateStr?: string;
  userFilter?: string;
};

export default function ClientAdminMarketingReport({
  entries = [],
  aggregates = undefined,
  selectedPeriodKey = "",
  dow = "",
  dateStr = "",
  userFilter = "",
}: Props) {
  const [selectedEntry, setSelectedEntry] = useState<MarketingReportEntry | null>(null);

  const summary = aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalItems: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0 },
    commission: { commission: 0, nextTarget: 1000000, tiersReached: [], nextTierReward: 0 },
  };

  const baseParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedPeriodKey) params.set("period", selectedPeriodKey);
    if (dateStr) params.set("date", dateStr);
    if (userFilter) params.set("user", userFilter);
    return params;
  }, [selectedPeriodKey, dateStr, userFilter]);

  const getDayHref = (dayLabel: string) => {
    const params = new URLSearchParams(baseParams);
    if (dayLabel === "All days") {
      params.delete("dow");
    } else {
      params.set("dow", dayLabel);
    }
    const qs = params.toString();
    return `/admin/marketing-report${qs ? `?${qs}` : ""}`;
  };

  const isActiveDay = (dayLabel: string) => (dayLabel === "All days" ? !dow : dow === dayLabel);

  const entriesList = entries;
  const hasEntries = entriesList.length > 0;
  const modalItemCount = selectedEntry
    ? (selectedEntry.receipts?.reduce((sum, rec) => sum + (rec.items?.length || 0), 0) ?? 0) ||
      (selectedEntry.sales?.reduce((sum, sale) => sum + (Number((sale as any).itemsCount) || 1), 0) ?? 0)
    : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-slate-100">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Marketing report</h1>
        <p className="text-slate-300">Admin view of the Marketing Performance Tracker with daily logs, channel completeness, and live session health.</p>
      </header>

      <section className={`${cardClasses} p-4 space-y-4`}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] items-start">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Trading period</div>
            <div className="text-lg font-semibold">{aggregates?.period?.label ?? selectedPeriodKey ?? "-"}</div>
          </div>
          <div className="flex items-center gap-2">
            <MultiDayExportClient periodKey={selectedPeriodKey} userFilter={userFilter} />
          </div>
        </div>

        <MarketingReportFilterBar
          initialPeriod={selectedPeriodKey}
          initialDay={dow}
          initialDate={dateStr}
          initialUser={userFilter}
        />

        <div className="flex flex-wrap gap-2">
          {dayLabels.map((label) => (
            <Link
              key={label}
              href={getDayHref(label)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                isActiveDay(label)
                  ? "bg-emerald-500 text-black border-emerald-500"
                  : "border-slate-700 text-slate-300 hover:border-white/40"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex gap-2">
          {selectedPeriodKey ? (
            <>
              <a
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500"
                href={`/api/admin/marketing-report/export-period?period=${encodeURIComponent(selectedPeriodKey)}${dow ? `&dow=${encodeURIComponent(dow)}` : ""}${userFilter ? `&user=${encodeURIComponent(userFilter)}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Export period CSV
              </a>
              <a
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500"
                href={`/api/admin/marketing-report/export-period-pdf?tradingPeriodKey=${encodeURIComponent(selectedPeriodKey)}${userFilter ? `&user=${encodeURIComponent(userFilter)}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Export period PDF
              </a>
            </>
          ) : (
            <div className="text-sm text-slate-400">Select a trading period to enable exports</div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-5 text-sm mt-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Period sales</div>
            <div className="text-xl font-semibold text-white">{formatKES(summary.totalSales ?? 0)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Period profit</div>
            <div className="text-xl font-semibold text-white">{formatKES(summary.totalProfit ?? 0)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Items sold</div>
            <div className="text-xl font-semibold text-white">{(summary.totalItems ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">MPESA vs Cash</div>
            <div className="text-sm text-slate-200">
              MPESA {formatKES(summary.paymentStats?.totalSalesMpesa ?? 0)}
              <br />
              Cash {formatKES(summary.paymentStats?.totalSalesCash ?? 0)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Commission (cumulative)</div>
            <div className="text-xl font-semibold text-white">{formatKES(summary.commission?.commission ?? 0)}</div>
            <div className="text-xs text-emerald-300">{(summary.commission?.tiersReached?.length ?? 0) ? `Tiers: ${summary.commission.tiersReached.join(", ")}` : "No tiers reached yet"}</div>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Progress toward next tier</span>
            <span className="text-emerald-300">Next reward: KES {summary.commission?.nextTierReward?.toLocaleString?.() ?? 0}</span>
          </div>
          <ProgressBar value={summary.commission?.commission ?? 0} max={summary.commission?.nextTarget ?? 1000000} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Daily breakdown</h3>
            <p className="text-xs text-slate-400">One row per day, blending marketing and attendant uploads.</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {["Date", "Day", "Channel", "Total sales", "Total profit", "Sales rows", "TikTok", "IG / FB / YT", "WhatsApp", "Live summary", "Stock enough?", "Shop ready?", "Weekly comment", "Actions"].map((col) => (
                  <th key={col} className="px-3 py-2">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!hasEntries ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-400" colSpan={14}>
                    No entries for this range yet.
                  </td>
                </tr>
              ) : (
                entriesList.map((entry, idx) => {
                  const dateStr = entry.date?.split?.("T")[0] ?? entry.date ?? "—";
                  const rowClass = idx % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40";
                  const tikTokDone = entry.tiktokPosted2Videos || entry.tiktokPosted4ExplanatoryVideos || entry.shot4ProductVideos;
                  const igDone = entry.igFbYtPosted2VideosEach;
                  const igReplied = entry.igFbYtRepliedAll;
                  const waDone = entry.waPostedStatus || entry.waPosted10Statuses;
                  const waReplied = entry.waRespondedAll;
                  const liveSummary = `${entry.liveSessionsCount ?? (entry.liveSessionsEstimatedViewers || entry.liveViewers ? 1 : 0)} sessions / ${entry.liveSessionsEstimatedViewers ?? entry.liveViewers ?? 0} viewers`;
                  const stockOk = Boolean(entry.stockEnoughFastMovers);
                  const shopReady = Boolean(entry.shopCleaned && entry.shopWellArranged && entry.displayWellLabeled);
                  const receiptsItems = entry.receipts?.reduce((sum, rec) => sum + (rec.items?.length || 0), 0) ?? 0;
                  const salesCount = entry.sales?.reduce((sum, sale) => sum + (Number((sale as any).itemsCount) || 1), 0) ?? 0;
                  const itemCount = receiptsItems || salesCount;
                  const channelLabel = entry.source === "ATTENDANT" ? "Attendant" : "Marketing";
                  const channelClass =
                    entry.source === "ATTENDANT"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-800 text-white/80 border border-slate-700";

                  return (
                    <tr key={entry.id} className={`border-t border-slate-800 ${rowClass}`}>
                      <td className="px-3 py-2 text-slate-200">{dateStr}</td>
                      <td className="px-3 py-2 text-slate-200">{entry.dayOfWeek ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${channelClass}`}>{channelLabel}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-white">{formatKES(entry.totalSales)}</td>
                      <td className="px-3 py-2 text-right text-slate-100">{formatKES(entry.totalProfit)}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{itemCount} items</td>
                      <td className="px-3 py-2 text-slate-200">
                        <div className="flex gap-2">
                          <span title="Posted">{tikTokDone ? "Y" : "N"}</span>
                          <span title="Replied">{entry.tiktokRepliedAll ? "Y" : "N"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        <div className="flex gap-2">
                          <span title="Posted">{igDone ? "Y" : "N"}</span>
                          <span title="Replied">{igReplied ? "Y" : "N"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        <div className="flex gap-2">
                          <span title="Status/contacts">{waDone ? "Y" : "N"}</span>
                          <span title="Replied all">{waReplied ? "Y" : "N"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">{liveSummary}</td>
                      <td className="px-3 py-2 text-center">{stockOk ? "Y" : "N"}</td>
                      <td className="px-3 py-2 text-center">{shopReady ? "Y" : "N"}</td>
                      <td className="px-3 py-2 text-slate-300" title={entry.weeklyComment || ""}>
                        {(entry.weeklyComment || "").slice(0, 40)}
                        {(entry.weeklyComment || "").length > 40 ? "…" : ""}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEntry(entry)}
                            className="text-xs text-sky-300 hover:text-sky-200 underline text-left"
                          >
                            View Day → Sales Details
                          </button>
                          <a
                            href={`/api/admin/marketing-report/export-day?entryId=${entry.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-300 underline hover:text-emerald-200"
                          >
                            Export day CSV
                          </a>
                          {entry.source === "MARKETING" && (
                            <Link
                              href={`/admin/marketing-report/${entry.id}/edit`}
                              className="text-xs text-white/80 underline hover:text-white"
                            >
                              Edit entry
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelectedEntry(null)} />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-black/60">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Sales details</p>
                <h3 className="text-2xl font-semibold text-white">{selectedEntry.date.split?.("T")[0] ?? selectedEntry.date}</h3>
                <p className="text-sm text-slate-400">
                  {selectedEntry.dayOfWeek ?? "—"} • {selectedEntry.source === "ATTENDANT" ? "Attendant" : "Marketing"} entry
                  {selectedEntry.submittedByName ? ` • ${selectedEntry.submittedByName}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-white"
                onClick={() => setSelectedEntry(null)}
                aria-label="Close sales details"
              >
                Close
              </button>
            </header>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Total sales</p>
                <p className="text-lg font-semibold text-white">{formatKES(selectedEntry.totalSales)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Total profit</p>
                <p className="text-lg font-semibold text-white">{formatKES(selectedEntry.totalProfit)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Items recorded</p>
                <p className="text-lg font-semibold text-white">{modalItemCount ?? 0}</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {selectedEntry.receipts && selectedEntry.receipts.length > 0 ? (
                selectedEntry.receipts.map((receipt, idx) => (
                  <div key={receipt.id ?? `receipt-${idx}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Receipt {receipt.receiptNumber || `#${idx + 1}`}
                        </p>
                        <p className="text-xs text-slate-400">{receipt.paymentMethod ?? "—"}</p>
                      </div>
                      <span className="text-sm font-semibold text-white">{formatKES(Number(receipt.sellingTotal ?? 0))}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(receipt.items || []).length === 0 ? (
                        <p className="text-xs text-slate-500">No items recorded for this receipt.</p>
                      ) : (
                        receipt.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between text-sm text-white/80">
                            <span>{item.productName || "(unnamed item)"}</span>
                            <span>{formatKES(Number(item.buyingPrice ?? 0))}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                  No receipt data available for this entry.
                </div>
              )}

              {selectedEntry.sales && selectedEntry.sales.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Sales rows</p>
                  <div className="mt-3 space-y-2">
                    {selectedEntry.sales.map((sale, idx) => (
                      <div key={idx} className="flex justify-between text-sm text-white/80">
                        <span>{sale.product || sale.productName || "—"}</span>
                        <span>{formatKES(Number((sale as any).sellingPrice ?? 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
