import MarketingReportFilterBar from "./FilterBar";
import { getMarketingReport } from "@/lib/marketingReport";
import SummaryPanelClient from "./SummaryPanelClient";
import WipeButtonClient from "./WipeButtonClient";
import WipeAllButtonClient from "./WipeAllButtonClient";
import { startOfDay, endOfDay, formatISO } from "date-fns";
import { auth } from "@/lib/auth";
import { getTradingPeriodFor, getRecentTradingPeriods } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

const currency = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
const check = (v: boolean) => (v ? "Y" : "N");

function InlineSparkline({ values, color = "#f59e0b" }: { values: number[]; color?: string }) {
  const w = 220;
  const h = 60;
  if (!values.length) return <svg width={w} height={h} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = Math.round(i * step);
    const y = Math.round(h - ((v - min) / range) * h);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth={2} points={points.join(" ")} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function MarketingReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const periodKey = typeof sp?.period === "string" ? sp.period : "";
  const dow = typeof sp?.dow === "string" ? sp.dow : "";
  const dateStr = typeof sp?.date === "string" ? sp.date : "";

  const currentPeriod = getTradingPeriodFor(new Date());
  const selectedPeriod =
    (periodKey && getRecentTradingPeriods(12).find((p) => p.key === periodKey)) || currentPeriod;

  const { entries, aggregates } = await getMarketingReport({
    tradingPeriodKey: selectedPeriod.key,
    dayOfWeek: dow || undefined,
    from: dateStr ? new Date(dateStr) : undefined,
    to: dateStr ? new Date(dateStr) : undefined,
  });

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const initialFrom = formatISO(todayStart);
  const initialTo = formatISO(todayEnd);

  // Determine if current user is ADMIN to show admin-only client panels (profit should be admin-only)
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  const isAdmin = role === "ADMIN";
  const totalDays = aggregates.totalDaysLogged || entries.length;
  const exportParams = new URLSearchParams();
  if (selectedPeriod?.key) exportParams.set("period", selectedPeriod.key);
  if (dow) exportParams.set("dow", dow);
  const exportUrl = `/api/admin/marketing-report/export-period${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;
  const exportPdfUrl = `/api/admin/marketing-report/export-period-pdf${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  const trend = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-14);
  const salesSeries = trend.map((e) => e.totalSales);
  const liveSeries = trend.map((e) => e.liveSessionsEstimatedViewers ?? e.liveViewers ?? 0);
  const nextTarget = aggregates.commission.nextTarget;
  const progress = nextTarget ? Math.min(1, aggregates.totalSales / nextTarget) : 1;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-slate-100">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Marketing report</h1>
        <p className="text-slate-300">
          Admin view of the Marketing Performance Tracker with daily logs, channel completeness, and live session health.
        </p>
      </header>

          <MarketingReportFilterBar initialPeriod={selectedPeriod.key} initialDay={dow} initialDate={dateStr} />

      {isAdmin ? <SummaryPanelClient initialFrom={initialFrom} initialTo={initialTo} /> : null}

      <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Trading period</div>
            <div className="text-lg font-semibold">{aggregates.period.label}</div>
          </div>
          <div className="flex gap-2">
            <a className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500" href={exportUrl}>
              Export period CSV
            </a>
            <a className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500" href={exportPdfUrl}>
              Export period PDF
            </a>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5 text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Period sales</div>
            <div className="text-xl font-semibold text-white">{currency(aggregates.totalSales)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Period profit</div>
            <div className="text-xl font-semibold text-white">{currency(aggregates.totalProfit)}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Items sold</div>
            <div className="text-xl font-semibold text-white">{aggregates.totalItems.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">MPESA vs Cash</div>
            <div className="text-sm text-slate-200">
              MPESA {currency(aggregates.paymentStats.totalSalesMpesa)}
              <br />
              Cash {currency(aggregates.paymentStats.totalSalesCash)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Commission (cumulative)</div>
            <div className="text-xl font-semibold text-white">{currency(aggregates.commission.commission)}</div>
            <div className="text-xs text-emerald-300">
              {aggregates.commission.tiersReached.length
                ? `Tiers: ${aggregates.commission.tiersReached.join(", ")}`
                : "No tiers reached yet"}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Commission is a discretionary incentive based on the current Betech Solar commission memo and may be reviewed or adjusted.
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              Progress toward next tier{" "}
              {nextTarget ? `(KES ${aggregates.totalSales.toLocaleString()} / ${nextTarget.toLocaleString()})` : "(Top tier reached)"}
            </span>
            {aggregates.commission.nextTierReward && nextTarget ? (
              <span className="text-emerald-300">Next reward: KES {aggregates.commission.nextTierReward.toLocaleString()}</span>
            ) : (
              <span className="text-emerald-300">All tiers unlocked</span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${Math.max(5, progress * 100)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total days logged", value: totalDays },
          { label: "Completion rate", value: `${aggregates.completionRate}%` },
          { label: "Total sales", value: currency(aggregates.totalSales) },
          { label: "Total profit", value: currency(aggregates.totalProfit) },
          { label: "Total items", value: aggregates.totalItems.toLocaleString() },
          { label: "Total live sessions", value: aggregates.totalLiveSessions },
          { label: "Total estimated viewers", value: aggregates.totalEstimatedViewers },
          { label: "Sales via MPESA", value: currency(aggregates.paymentStats.totalSalesMpesa) },
          { label: "Sales via Cash", value: currency(aggregates.paymentStats.totalSalesCash) },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20"
          >
            <div className="text-xs uppercase tracking-wide text-slate-400">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{kpi.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Channel performance snapshot</h2>
            <span className="text-xs text-slate-400">vs {totalDays || 1} days</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">TikTok</div>
              <div className="mt-1 flex justify-between text-slate-200">
                <span>Posted</span>
                <span>
                  {aggregates.channelStats.tiktokPostedDays} / {totalDays}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Replied</span>
                <span>
                  {aggregates.channelStats.tiktokRepliedDays} / {totalDays}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">IG / FB / YT</div>
              <div className="mt-1 flex justify-between text-slate-200">
                <span>Posted</span>
                <span>
                  {aggregates.channelStats.igFbYtPostedDays} / {totalDays}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Replied</span>
                <span>
                  {aggregates.channelStats.igFbYtRepliedDays} / {totalDays}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">WhatsApp</div>
              <div className="mt-1 flex justify-between text-slate-200">
                <span>Status posted</span>
                <span>
                  {aggregates.channelStats.waStatusDays} / {totalDays}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>Contacts added</span>
                <span>
                  {aggregates.channelStats.waContactsDays} / {totalDays}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span>All replied</span>
                <span>
                  {aggregates.channelStats.waRepliedDays} / {totalDays}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20 space-y-4">
          <div className="text-lg font-semibold">Live sessions summary</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Total live sessions</div>
              <div className="text-xl font-semibold text-white">{aggregates.totalLiveSessions}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Avg duration (min)</div>
              <div className="text-xl font-semibold text-white">{aggregates.avgLiveDurationMinutes}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Top platform</div>
              <div className="text-xl font-semibold text-white">{aggregates.topLivePlatform || "–"}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Estimated viewers</div>
              <div className="text-xl font-semibold text-white">{aggregates.totalEstimatedViewers}</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
            Stock ready: {aggregates.stockStats.stockEnoughDays} / {totalDays} days &middot; Shop ready:{" "}
            {aggregates.shopStats.shopCleanedDays} / {totalDays} cleaned
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Trend (sales vs live viewers)</h3>
            <p className="text-xs text-slate-400">Last {trend.length} entries</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Sales (KES)</div>
            <InlineSparkline values={salesSeries} color="#f59e0b" />
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Live viewers</div>
            <InlineSparkline values={liveSeries} color="#22c55e" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Daily breakdown</h3>
            <p className="text-xs text-slate-400">One row per MarketingDailyEntry</p>
          </div>
          <a
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-slate-500"
            href={exportUrl}
          >
            Export CSV
          </a>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {[
                  "Date",
                  "Day",
                  "Total sales",
                  "Total profit",
                  "Sales rows",
                  "TikTok",
                  "IG/FB/YT",
                  "WhatsApp",
                  "Live summary",
                  "Stock enough?",
                  "Shop ready?",
                  "Weekly comment",
                  "Export",
                ].map((col) => (
                  <th key={col} className="px-3 py-2">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const dateStr = e.date.split("T")[0];
                const tikTokDone = e.tiktokPosted2Videos || e.tiktokPosted4ExplanatoryVideos || e.shot4ProductVideos;
                const igDone = e.igFbYtPosted2VideosEach;
                const igReplied = e.igFbYtRepliedAll;
                const waDone = e.waPostedStatus || e.waPosted10Statuses;
                const waReplied = e.waRespondedAll;
                const liveSummary = `${e.liveSessionsCount ?? (e.liveSessionsEstimatedViewers || e.liveViewers ? 1 : 0)} sessions / ${
                  e.liveSessionsEstimatedViewers ?? e.liveViewers ?? 0
                } viewers`;
                const stockOk = Boolean(e.stockEnoughFastMovers);
                const shopReady = Boolean(e.shopCleaned && e.shopWellArranged && e.displayWellLabeled);
                return (
                  <tr key={e.id} className="border-t border-slate-800 odd:bg-slate-950/40">
                    <td className="px-3 py-2 text-slate-200">{dateStr}</td>
                    <td className="px-3 py-2 text-slate-200">{e.dayOfWeek}</td>
                    <td className="px-3 py-2 font-semibold text-white">{currency(e.totalSales)}</td>
                    <td className="px-3 py-2 text-slate-100">{currency(e.totalProfit)}</td>
                    <td className="px-3 py-2 text-slate-200">{`${(e.sales || []).reduce((sum, s) => sum + ((s as any).itemsCount || 1), 0)} items / ${currency(e.totalSales)}`}</td>
                    <td className="px-3 py-2 text-slate-200">
                      <div className="flex gap-2">
                        <span title="Posted">{check(Boolean(tikTokDone))}</span>
                        <span title="Replied">{check(Boolean(e.tiktokRepliedAll))}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      <div className="flex gap-2">
                        <span title="Posted">{check(Boolean(igDone))}</span>
                        <span title="Replied">{check(Boolean(igReplied))}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      <div className="flex gap-2">
                        <span title="Status/contacts">{check(Boolean(waDone))}</span>
                        <span title="Replied all">{check(Boolean(waReplied))}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-200">{liveSummary}</td>
                    <td className="px-3 py-2 text-center">{check(stockOk)}</td>
                    <td className="px-3 py-2 text-center">{check(shopReady)}</td>
                    <td className="px-3 py-2 text-slate-300" title={e.weeklyComment || ""}>
                      {(e.weeklyComment || "").slice(0, 40)}
                      {(e.weeklyComment || "").length > 40 ? "." : ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 items-center">
                        <a
                          href={`/api/admin/marketing-report/export-day?entryId=${e.id}`}
                          className="text-xs text-emerald-300 underline hover:text-emerald-200"
                        >
                          Export day CSV
                        </a>
                        <a href={`/admin/marketing-report/${e.id}/edit`} className="text-xs text-sky-300 underline hover:text-sky-200">
                          Edit
                        </a>
                        <WipeButtonClient entryId={e.id} />
                        {e.submittedById ? <WipeAllButtonClient userId={e.submittedById} periodKey={selectedPeriod?.key} /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-400" colSpan={13}>
                    No marketing entries for this range yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
