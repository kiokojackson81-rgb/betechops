"use client";

import React from "react";
import ProgressBar from "@/app/_components/ProgressBar";
import MarketingReportFilterBar from "./FilterBar";
import MultiDayExportClient from "./MultiDayExportClient";

const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

type Props = {
  entries?: any[];
  aggregates?: any;
  selectedPeriodKey?: string;
  dow?: string;
  dateStr?: string;
  initialFrom?: string;
  initialTo?: string;
  isAdmin?: boolean;
  userFilter?: string;
};

export default function ClientAdminMarketingReport({
  entries = [],
  aggregates = undefined,
  selectedPeriodKey = "",
  dow = "",
  dateStr = "",
  initialFrom = "",
  initialTo = "",
  isAdmin = false,
  userFilter = undefined,
}: Props) {
  const summary = aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalItems: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0 },
    commission: { commission: 0, nextTarget: 1000000, tiersReached: [], nextTierReward: 0 },
  };

  const formatKES = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-slate-100">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Marketing report</h1>
        <p className="text-slate-300">Admin view of the Marketing Performance Tracker with daily logs, channel completeness, and live session health.</p>
      </header>

      {/* Filters are still server-side controlled; client shows period label when available */}
      <section className={`${cardClasses} p-4 space-y-4`}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] items-start">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Trading period</div>
            <div className="text-lg font-semibold">{aggregates?.period?.label ?? selectedPeriodKey ?? "—"}</div>
          </div>
          <div className="flex items-center gap-2">
            <MultiDayExportClient periodKey={selectedPeriodKey} userFilter={userFilter} />
          </div>
        </div>

        {/* Server-controlled filter bar (hydrates to allow applying filters which navigate) */}
        <MarketingReportFilterBar initialPeriod={selectedPeriodKey} initialDay={dow} initialDate={dateStr} />

        <div className="flex gap-2">
          {/* Wire export links to server endpoints using the server-provided period/day values */}
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
            <div className="text-xl font-semibold text-white">{formatKES(summary.totalSales ?? summary.totalSales)}</div>
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
            <div className="text-xs text-emerald-300">{(summary.commission?.tiersReached?.length ?? 0) ? `Tiers: ${summary.commission.tiersReached.join(", ")}` : 'No tiers reached yet'}</div>
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Daily breakdown</h3>
            <p className="text-xs text-slate-400">One row per MarketingDailyEntry</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {["Date","Day","Total sales","Total profit","Sales rows","TikTok","IG/FB/YT","WhatsApp","Live summary","Stock enough?","Shop ready?","Weekly comment","Export"].map(col=> (
                  <th key={col} className="px-3 py-2">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={13}>No marketing entries for this range yet.</td></tr>
              ) : (
                entries.map((e:any)=> {
                  const dateStr = (e.date||"").split("T")[0] || e.date;
                  const tikTokDone = e.tiktokPosted2Videos || e.tiktokPosted4ExplanatoryVideos || e.shot4ProductVideos;
                  const igDone = e.igFbYtPosted2VideosEach;
                  const igReplied = e.igFbYtRepliedAll;
                  const waDone = e.waPostedStatus || e.waPosted10Statuses;
                  const waReplied = e.waRespondedAll;
                  const liveSummary = `${e.liveSessionsCount ?? (e.liveSessionsEstimatedViewers || e.liveViewers ? 1 : 0)} sessions / ${e.liveSessionsEstimatedViewers ?? e.liveViewers ?? 0} viewers`;
                  const stockOk = Boolean(e.stockEnoughFastMovers);
                  const shopReady = Boolean(e.shopCleaned && e.shopWellArranged && e.displayWellLabeled);
                  return (
                    <tr key={e.id} className="border-t border-slate-800 odd:bg-slate-950/40">
                      <td className="px-3 py-2 text-slate-200">{dateStr}</td>
                      <td className="px-3 py-2 text-slate-200">{e.dayOfWeek}</td>
                      <td className="px-3 py-2 font-semibold text-white">{formatKES(e.totalSales)}</td>
                      <td className="px-3 py-2 text-slate-100">{formatKES(e.totalProfit)}</td>
                      <td className="px-3 py-2 text-slate-200">{`${(e.sales||[]).reduce((sum:any,s:any)=> sum + ((s.itemsCount||1)),0)} items / ${formatKES(e.totalSales)}`}</td>
                      <td className="px-3 py-2 text-slate-200"><div className="flex gap-2"><span title="Posted">{tikTokDone? 'Y':'N'}</span><span title="Replied">{e.tiktokRepliedAll? 'Y':'N'}</span></div></td>
                      <td className="px-3 py-2 text-slate-200"><div className="flex gap-2"><span title="Posted">{igDone? 'Y':'N'}</span><span title="Replied">{igReplied? 'Y':'N'}</span></div></td>
                      <td className="px-3 py-2 text-slate-200"><div className="flex gap-2"><span title="Status/contacts">{waDone? 'Y':'N'}</span><span title="Replied all">{waReplied? 'Y':'N'}</span></div></td>
                      <td className="px-3 py-2 text-slate-200">{liveSummary}</td>
                      <td className="px-3 py-2 text-center">{stockOk? 'Y':'N'}</td>
                      <td className="px-3 py-2 text-center">{shopReady? 'Y':'N'}</td>
                      <td className="px-3 py-2 text-slate-300" title={e.weeklyComment||""}>{(e.weeklyComment||"").slice(0,40)}{(e.weeklyComment||"").length>40?'.':''}</td>
                      <td className="px-3 py-2"><div className="flex gap-2 items-center"><a href={`/api/admin/marketing-report/export-day?entryId=${e.id}`} className="text-xs text-emerald-300 underline hover:text-emerald-200">Export day CSV</a></div></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
