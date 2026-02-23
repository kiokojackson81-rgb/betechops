import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPreviousTradingPeriod, getTradingPeriodFor, parseTradingPeriodKey, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import PerformanceFiltersClient from "@/app/admin/online/performance/_components/PerformanceFilters.client";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

type SearchParams = { periodKey?: string; accountId?: string };

function getNextTradingPeriod(period: TradingPeriod): TradingPeriod {
  const nextDay = new Date(period.end.getTime() + 24 * 60 * 60 * 1000);
  return getTradingPeriodFor(nextDay);
}

export default async function OnlinePerformancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const resolved = await Promise.resolve(searchParams ?? {});
  const period = parseTradingPeriodKey(resolved.periodKey) ?? getTradingPeriodFor(new Date());
  const accountId = (resolved.accountId ?? "").trim();
  const now = new Date();

  const weeks = getOnlineOpsWeeksForTradingPeriod(period, now, 4);
  const weekStarts = weeks.map((w) => w.weekStart);

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { isActive: true },
    select: { id: true, platform: true, displayName: true },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });

  let perWeekAgg: any[] = [];
  let perWeekLossCount: any[] = [];
  let dbReady = true;
  let isLossColumnReady = true;
  let accountIdColumnReady = true;
  try {
    [perWeekAgg, perWeekLossCount] = await Promise.all([
      (prisma as any).marketplaceProfitEntry.groupBy({
        by: ["weekStart"],
        _sum: { netPayout: true, profit: true },
        _avg: { commissionRatePct: true },
        where: { weekStart: { in: weekStarts }, periodKey: period.key, ...(accountId ? { accountId } : {}) },
        orderBy: { weekStart: "asc" },
      }),
      (prisma as any).marketplaceProfitEntry.groupBy({
        by: ["weekStart"],
        _count: { _all: true },
        where: {
          weekStart: { in: weekStarts },
          periodKey: period.key,
          isLoss: true,
          ...(accountId ? { accountId } : {}),
        },
        orderBy: { weekStart: "asc" },
      }),
    ]);
  } catch (err: any) {
    if (err?.code === "P2021") {
      dbReady = false;
    } else if (err?.code === "P2022") {
      // Backward compatible: database hasn't migrated to include `isLoss` yet.
      isLossColumnReady = false;
      if (accountId) accountIdColumnReady = false;
      perWeekAgg =
        perWeekAgg.length > 0
          ? perWeekAgg
          : await (prisma as any).marketplaceProfitEntry.groupBy({
              by: ["weekStart"],
              _sum: { netPayout: true, profit: true },
              _avg: { commissionRatePct: true },
              where: { weekStart: { in: weekStarts }, periodKey: period.key },
              orderBy: { weekStart: "asc" },
            });
      perWeekLossCount = await (prisma as any).marketplaceProfitEntry.groupBy({
        by: ["weekStart"],
        _count: { _all: true },
        where: {
          weekStart: { in: weekStarts },
          periodKey: period.key,
          profit: { lt: 0 },
        },
        orderBy: { weekStart: "asc" },
      });
    } else {
      throw err;
    }
  }

  const lossMap = new Map(
    (perWeekLossCount as any[]).map((row) => [new Date(row.weekStart).toISOString(), Number(row._count?._all ?? 0)]),
  );
  const aggMap = new Map(
    (perWeekAgg as any[]).map((row) => [
      new Date(row.weekStart).toISOString(),
      {
        netPayout: Number(row._sum?.netPayout ?? 0),
        profit: Number(row._sum?.profit ?? 0),
        avgCommissionRate: Number(row._avg?.commissionRatePct ?? 0),
      },
    ]),
  );

  const previousPeriod = getPreviousTradingPeriod(period);
  const nextPeriod = getNextTradingPeriod(period);
  const currentPeriod = getTradingPeriodFor(new Date());
  const lastPeriod = getPreviousTradingPeriod(currentPeriod);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Performance</h1>
        <p className="text-sm text-slate-400">
          Trading period: {period.label}. Showing the 4 Monday–Sunday weeks within this period.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/admin/online/performance"
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              period.key === currentPeriod.key
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-slate-200 hover:bg-white/5"
            }`}
          >
            Current period
          </Link>
          <Link
            href={`/admin/online/performance?periodKey=${encodeURIComponent(lastPeriod.key)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              period.key === lastPeriod.key
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-slate-200 hover:bg-white/5"
            }`}
          >
            Previous period
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Trading period dashboard</h2>
            <p className="text-sm text-slate-400">Profit, net payout, and loss monitoring based on captured profit entries.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/online/performance?periodKey=${encodeURIComponent(previousPeriod.key)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Previous period
            </Link>
            <Link
              href={`/admin/online/performance?periodKey=${encodeURIComponent(nextPeriod.key)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Next period
            </Link>
            <Link
              href="/admin/online/performance/capture"
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
            >
              Capture profit
            </Link>
            <Link
              href={`/admin/online/performance/loss?periodKey=${encodeURIComponent(period.key)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`}
              className="inline-flex items-center justify-center rounded-full border border-amber-400/50 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10"
            >
              Loss monitor
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <PerformanceFiltersClient accounts={accounts} />
        </div>

        {!dbReady && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Performance tables are not available yet (database migration pending). Redeploy to apply migrations, then refresh.
          </div>
        )}
        {dbReady && !isLossColumnReady && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Database is missing the `isLoss` column. Reports are using `profit &lt; 0` fallback until migrations are applied.
          </div>
        )}
        {dbReady && !accountIdColumnReady && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Database is missing the `accountId` column. Shop filtering is temporarily disabled until migrations are applied.
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {weeks.map((wk) => {
            const agg = aggMap.get(wk.weekStart.toISOString()) ?? { netPayout: 0, profit: 0, avgCommissionRate: 0 };
            const lossCount = lossMap.get(wk.weekStart.toISOString()) ?? 0;
            return (
              <Link
                key={wk.key}
                href={`/admin/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`}
                className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-4 hover:bg-white/5"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">Week</p>
                <p className="mt-1 text-sm font-semibold text-white">{wk.label}</p>
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Net payout</span>
                    <span className="font-semibold text-emerald-300">{currency.format(agg.netPayout)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Profit</span>
                    <span className={`font-semibold ${agg.profit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                      {currency.format(agg.profit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Loss entries</span>
                    <span className="font-semibold text-amber-200">{lossCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Avg commission %</span>
                    <span className="font-semibold text-slate-200">{agg.avgCommissionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Notes</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          <li>- Profit entries are captured from pasted marketplace transaction blocks.</li>
          <li>- Net payout = item credit + commission + shipping (commission/shipping stored as negative).</li>
          <li>- Profit = net payout - buying price.</li>
        </ul>
      </section>
    </div>
  );
}
