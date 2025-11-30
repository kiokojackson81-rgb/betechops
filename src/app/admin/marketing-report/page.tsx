export const dynamic = "force-dynamic";

const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

const tradingPeriods = ["Nov 25, 2025 - Dec 24, 2025", "Oct 25, 2025 - Nov 24, 2025", "Sep 25, 2025 - Oct 24, 2025"];

const defaultSummary = {
  sales: 0,
  profit: 0,
  items: 0,
  mpesa: 0,
  cash: 0,
  commission: 0,
  nextTarget: 1_000_000,
  nextReward: 10_000,
  liveSessions: 0,
  liveViewers: 0,
};

const channelSnapshot = {
  tiktok: { posted: "0 / 0", replied: "0 / 0" },
  igfb: { posted: "0 / 0", replied: "0 / 0" },
  whatsapp: { status: "0 / 0", contacts: "0 / 0", replied: "0 / 0" },
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

const formatKES = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

export default function AdminMarketingReportPage() {
  const summary = defaultSummary;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold">Marketing Report</h1>
          <p className="text-sm text-slate-400">
            Admin view of the Marketing Performance Tracker showing KPIs, channel health and daily logs.
          </p>
        </header>

        <section className={`${cardClasses} p-4 space-y-4`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Trading period</label>
              <select className="w-60 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100">
                {tradingPeriods.map((period) => (
                  <option key={period}>{period}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {["All days", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                <button
                  key={day}
                  type="button"
                  className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-emerald-500 hover:text-white"
                >
                  {day}
                </button>
              ))}
            </div>
            <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95">
              Apply filters
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Export period CSV</button>
            <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Export period PDF</button>
          </div>
        </section>

        <section className={`${cardClasses} p-4 space-y-4`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Period sales</p>
              <p className="text-2xl font-semibold">{formatKES(summary.sales)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Period profit</p>
              <p className="text-2xl font-semibold">{formatKES(summary.profit)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Items sold</p>
              <p className="text-2xl font-semibold">{summary.items.toLocaleString("en-KE")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">MPESA vs Cash</p>
              <p className="text-lg font-medium text-white">
                MPESA {formatKES(summary.mpesa)} <span className="opacity-50">•</span> Cash {formatKES(summary.cash)}
              </p>
            </div>
          </div>
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Commission (cumulative)</div>
            <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
              <div className="flex-1 text-2xl font-semibold text-white">{formatKES(summary.commission)}</div>
              <div className="text-xs text-slate-400">
                Next reward: {formatKES(summary.nextReward)} · Target: {formatKES(summary.nextTarget)}
              </div>
            </div>
            <progress className="w-full h-2 rounded-full" value={summary.commission} max={summary.nextTarget}></progress>
          </div>
        </section>

        <section className={`${cardClasses} p-4 space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Channel performance snapshot</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-1">
              <h3 className="text-sm font-semibold">TikTok</h3>
              <p className="text-xs text-slate-400">Posted: <span className="text-emerald-300">{channelSnapshot.tiktok.posted}</span></p>
              <p className="text-xs text-slate-400">Replied: <span className="text-emerald-300">{channelSnapshot.tiktok.replied}</span></p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-1">
              <h3 className="text-sm font-semibold">Instagram / Facebook / YouTube</h3>
              <p className="text-xs text-slate-400">Posted: <span className="text-emerald-300">{channelSnapshot.igfb.posted}</span></p>
              <p className="text-xs text-slate-400">Replied: <span className="text-emerald-300">{channelSnapshot.igfb.replied}</span></p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-1">
              <h3 className="text-sm font-semibold">WhatsApp</h3>
              <p className="text-xs text-slate-400">Status: <span className="text-emerald-300">{channelSnapshot.whatsapp.status}</span></p>
              <p className="text-xs text-slate-400">Contacts: <span className="text-emerald-300">{channelSnapshot.whatsapp.contacts}</span></p>
              <p className="text-xs text-slate-400">Replied: <span className="text-emerald-300">{channelSnapshot.whatsapp.replied}</span></p>
            </div>
          </div>
        </section>

        <section className={`${cardClasses} p-4 space-y-4`}>
          <h2 className="text-xl font-semibold">Live sessions summary</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Total live sessions</p>
              <p className="text-2xl font-semibold text-white">{summary.liveSessions}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Estimated viewers</p>
              <p className="text-2xl font-semibold text-white">{summary.liveViewers}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg duration (min)</p>
              <p className="text-2xl font-semibold text-white">0</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Top platform</p>
              <p className="text-2xl font-semibold text-white">—</p>
            </div>
          </div>
        </section>

        <section className={`${cardClasses} p-4`}>
          <h2 className="text-xl font-semibold">Trend (sales vs live viewers)</h2>
          <p className="text-xs text-slate-400">Placeholder for a chart component.</p>
          <div className="mt-3 flex h-40 items-center justify-center rounded-xl border border-slate-800">
            <span className="text-sm text-slate-500">Chart goes here</span>
          </div>
        </section>

        <section className={`${cardClasses} p-4 overflow-x-auto`}>
          <h2 className="text-xl font-semibold mb-3">Daily breakdown</h2>
          {dailyEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No marketing entries for this range yet.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/70 border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                <tr>
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
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.map((entry, idx) => (
                  <tr
                    key={entry.date}
                    className={`border-t border-slate-800 ${idx % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40"}`}
                  >
                    <td className="px-3 py-2 text-slate-200">{entry.date}</td>
                    <td className="px-3 py-2 text-slate-200">{entry.day}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{formatKES(entry.totalSales)}</td>
                    <td className="px-3 py-2 text-right text-slate-100">{formatKES(entry.totalProfit)}</td>
                    <td className="px-3 py-2 text-slate-200">{entry.items} items</td>
                    <td className="px-3 py-2 text-slate-200">{entry.tiktok.posted} / {entry.tiktok.replied}</td>
                    <td className="px-3 py-2 text-slate-200">{entry.igfb.posted} / {entry.igfb.replied}</td>
                    <td className="px-3 py-2 text-slate-200">{entry.whatsapp.status} / {entry.whatsapp.replied}</td>
                    <td className="px-3 py-2 text-slate-200">{entry.live.sessions} / {entry.live.viewers}</td>
                    <td className="px-3 py-2 text-center">{entry.stockOk ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-center">{entry.shopReady ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-slate-300">
                      <div className="flex gap-3">
                        <button className="text-xs text-emerald-300 underline hover:text-emerald-200">Export</button>
                        <button className="text-xs text-sky-300 underline hover:text-sky-200">Edit</button>
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
}
