"use client";

import React from "react";
import Card from "@/app/_components/Card";
import ProgressBar from "@/app/_components/ProgressBar";

// Define a reusable set of classes for cards to match the tracker aesthetic.
const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

const AdminMarketingReportPage: React.FC = () => {
  // Placeholder data – replace these with real values from your API
  const tradingPeriods = [
    "Nov\u00A025,\u00A02025\u00A0\u2013\u00A0Dec\u00A024,\u00A02025",
    "Oct\u00A025,\u00A02025\u00A0\u2013\u00A0Nov\u00A024,\u00A02025",
    "Sep\u00A025,\u00A02025\u00A0\u2013\u00A0Oct\u00A024,\u00A02025",
  ];
  const currentPeriod = tradingPeriods[0];
  const summary = {
    sales: 0,
    profit: 0,
    items: 0,
    mpesa: 0,
    cash: 0,
    commission: 0,
    nextTarget: 1_000_000,
    nextReward: 10_000,
    daysLogged: 0,
    completionRate: 0,
    liveSessions: 0,
    liveViewers: 0,
  };
  const channelSnapshot = {
    tiktok: { posted: "0 / 0", replied: "0 / 0" },
    igfb: { posted: "0 / 0", replied: "0 / 0" },
    whatsapp: { status: "0 / 0", contacts: "0 / 0", replied: "0 / 0" },
  };
  const liveSummary = {
    totalSessions: 0,
    avgDuration: 0,
    topPlatform: "–",
    estimatedViewers: 0,
  };
  const dailyEntries: Array<{
    date: string;
    day: string;
    totalSales: number;
    totalProfit: number;
    items: number;
    tiktok: { posted: string; replied: string };
    igfb: { posted: string; replied: string };
    whatsapp: { status: string; replied: string };
    live: { sessions: number; viewers: number };
    stockOk: boolean;
    shopReady: boolean;
  }> = [];

  // Helper to format currency
  const formatKES = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-3xl font-semibold mb-1">Marketing Report</h1>
          <p className="text-sm text-slate-400">
            Admin view of the Marketing Performance Tracker with daily logs,
            channel completeness and live session health.
          </p>
        </div>

        {/* Filters and export actions */}
        <section className={`${cardClasses} p-4 space-y-4`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            {/* Trading period select */}
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Trading period
              </label>
              <select
                className="w-56 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                value={currentPeriod}
                onChange={() => {}}
              >
                {tradingPeriods.map((period) => (
                  <option key={period}>{period}</option>
                ))}
              </select>
            </div>

            {/* Day of week filter chips */}
            <div className="flex flex-wrap gap-2">
              {['All days', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                (day) => (
                  <button
                    key={day}
                    type="button"
                    className="rounded-full px-4 py-2 text-xs border border-white/10 bg-slate-800 text-slate-200 hover:bg-slate-700 focus:bg-emerald-500 focus:text-black focus:border-emerald-600"
                    onClick={() => {}}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>

            {/* Apply filters button */}
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
            >
              Apply filters
            </button>
          </div>

          {/* Export actions */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm border border-white/10 text-slate-200 bg-transparent hover:bg-white/5"
            >
              Export period CSV
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm border border-white/10 text-slate-200 bg-transparent hover:bg-white/5"
            >
              Export period PDF
            </button>
          </div>
        </section>

        {/* Summary KPIs */}
        <section className={`${cardClasses} p-4`}>          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Period Sales */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Period sales
              </p>
              <p className="text-2xl font-semibold text-white">
                {formatKES(summary.sales)}
              </p>
            </div>
            {/* Period Profit */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Period profit
              </p>
              <p className="text-2xl font-semibold text-white">
                {formatKES(summary.profit)}
              </p>
            </div>
            {/* Items sold */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Items sold
              </p>
              <p className="text-2xl font-semibold text-white">
                {summary.items.toLocaleString('en-KE')}
              </p>
            </div>
            {/* MPESA vs Cash */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                MPESA vs Cash
              </p>
              <p className="text-lg font-medium text-white flex items-baseline gap-2">
                <span>MPESA {formatKES(summary.mpesa)}</span>
                <span className="opacity-50">·</span>
                <span>Cash {formatKES(summary.cash)}</span>
              </p>
            </div>
            {/* Commission */}
            <div className="sm:col-span-2 md:col-span-2 lg:col-span-4 flex flex-col gap-2 mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Commission (cumulative)
              </p>
              <p className="text-xl font-semibold text-white">
                {formatKES(summary.commission)}
              </p>
              <p className="text-sm text-slate-400">
                {summary.commission === 0
                  ? 'No tiers reached yet'
                  : `Next reward: KES ${summary.nextReward.toLocaleString('en-KE')}`}
              </p>
              <div>
                <label className="text-[11px] opacity-70 mb-1 block">
                  Progress toward next tier (KES {summary.commission.toLocaleString('en-KE')} /{' '}
                  {summary.nextTarget.toLocaleString('en-KE')})
                </label>
                <ProgressBar value={summary.commission} max={summary.nextTarget} />
              </div>
            </div>
          </div>
        </section>

        {/* Channel performance snapshot */}
        <section className={`${cardClasses} p-4 space-y-4`}>
          <h2 className="text-xl font-semibold mb-2">Channel performance snapshot</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* TikTok card */}
            <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
              <h3 className="text-sm font-semibold">TikTok</h3>
              <p className="text-sm text-slate-400">
                Posted: <span className="text-emerald-300">{channelSnapshot.tiktok.posted}</span>
              </p>
              <p className="text-sm text-slate-400">
                Replied: <span className="text-emerald-300">{channelSnapshot.tiktok.replied}</span>
              </p>
            </div>
            {/* IG/FB/YT card */}
            <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
              <h3 className="text-sm font-semibold">Instagram / Facebook / YouTube</h3>
              <p className="text-sm text-slate-400">
                Posted: <span className="text-emerald-300">{channelSnapshot.igfb.posted}</span>
              </p>
              <p className="text-sm text-slate-400">
                Replied: <span className="text-emerald-300">{channelSnapshot.igfb.replied}</span>
              </p>
            </div>
            {/* WhatsApp card */}
            <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
              <h3 className="text-sm font-semibold">WhatsApp</h3>
              <p className="text-sm text-slate-400">
                Status posted: <span className="text-emerald-300">{channelSnapshot.whatsapp.status}</span>
              </p>
              <p className="text-sm text-slate-400">
                Contacts added: <span className="text-emerald-300">{channelSnapshot.whatsapp.contacts}</span>
              </p>
              <p className="text-sm text-slate-400">
                All replied: <span className="text-emerald-300">{channelSnapshot.whatsapp.replied}</span>
              </p>
            </div>
          </div>
        </section>

        {/* Live sessions summary */}
        <section className={`${cardClasses} p-4 space-y-4`}>
          <h2 className="text-xl font-semibold">Live sessions summary</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Total live sessions
              </p>
              <p className="text-2xl font-semibold text-white">
                {liveSummary.totalSessions}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Avg duration (min)
              </p>
              <p className="text-2xl font-semibold text-white">
                {liveSummary.avgDuration}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Top platform
              </p>
              <p className="text-2xl font-semibold text-white">
                {liveSummary.topPlatform}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Estimated viewers
              </p>
              <p className="text-2xl font-semibold text-white">
                {liveSummary.estimatedViewers}
              </p>
            </div>
          </div>
        </section>

        {/* Trend chart placeholder */}
        <section className={`${cardClasses} p-4 space-y-4`}>
          <h2 className="text-xl font-semibold">Trend (sales vs live viewers)</h2>
          <p className="text-sm text-slate-400">Last {dailyEntries.length} entries</p>
          <div className="h-40 flex items-center justify-center text-slate-500 border border-slate-800 rounded-xl">
            {/* Replace this with an actual chart using recharts, chart.js, etc. */}
            <span className="text-sm">Chart goes here</span>
          </div>
        </section>

        {/* Daily breakdown table */}
        <section className={`${cardClasses} p-4 overflow-x-auto`}>
          <h2 className="text-xl font-semibold mb-3">Daily breakdown</h2>
          {dailyEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No marketing entries for this range yet.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/70 border-b border-slate-800">
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2 text-right">Total sales</th>
                  <th className="px-3 py-2 text-right">Total profit</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">TikTok</th>
                  <th className="px-3 py-2">IG / FB / YT</th>
                  <th className="px-3 py-2">WhatsApp</th>
                  <th className="px-3 py-2">Live summary</th>
                  <th className="px-3 py-2 text-center">Stock OK?</th>
                  <th className="px-3 py-2 text-center">Shop ready?</th>
                  <th className="px-3 py-2">Export</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.map((entry, idx) => (
                  <tr
                    key={entry.date}
                    className={`border-t border-slate-800 ${idx % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/40'}`}
                  >
                    <td className="px-3 py-2 text-slate-200">{entry.date}</td>
                    <td className="px-3 py-2 text-slate-200">{entry.day}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">
                      {formatKES(entry.totalSales)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-100">
                      {formatKES(entry.totalProfit)}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {entry.items} items
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {entry.tiktok.posted} / {entry.tiktok.replied}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {entry.igfb.posted} / {entry.igfb.replied}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {entry.whatsapp.status} / {entry.whatsapp.replied}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {entry.live.sessions} sessions / {entry.live.viewers} viewers
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.stockOk ? '✔' : '✖'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.shopReady ? '✔' : '✖'}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      <div className="flex gap-2 items-center">
                        <button className="text-xs text-emerald-300 underline hover:text-emerald-200">
                          Export day CSV
                        </button>
                        <button className="text-xs text-sky-300 underline hover:text-sky-200">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminMarketingReportPage;
