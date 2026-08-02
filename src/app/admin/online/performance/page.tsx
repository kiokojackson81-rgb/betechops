import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPreviousTradingPeriod, getTradingPeriodFor, parseTradingPeriodKey, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import PerformanceFiltersClient from "@/app/admin/online/performance/_components/PerformanceFilters.client";
import PricingWeekWhatsappButton from "@/app/admin/online/performance/_components/PricingWeekWhatsappButton.client";
import { WeeklySaleStatus } from "@prisma/client";
import { resolveShopIdsForMarketplaceAccount } from "@/lib/marketplaceAccountShopResolve";
import { getPricingWeekSummary, PRICING_WEEK_ENTITY, PRICING_WEEK_SUCCESS_ACTION } from "@/lib/pricingWeekWhatsapp";
import { getOperatingCapitalSummary } from "@/lib/operatingCapital";

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
  const actorId = String((session?.user as any)?.id ?? "").trim() || null;
  const email = String((session?.user as any)?.email ?? "").toLowerCase();
  const isBenjamin = email === "benjamin@betech.co.ke";
  const limitedView = isBenjamin && role !== "ADMIN";
  if (role !== "ADMIN" && role !== "SUPERVISOR" && !isBenjamin) {
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
  let perWeekWeeklySales: any[] = [];
  let perWeekMissingPricing: any[] = [];
  let dbReady = true;
  let isLossColumnReady = true;
  let accountIdColumnReady = true;
  try {
    const shopIdsForWeeklySales = accountId ? await resolveShopIdsForMarketplaceAccount(accountId) : [];

    [perWeekAgg, perWeekLossCount, perWeekWeeklySales, perWeekMissingPricing] = await Promise.all([
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
      (prisma as any).weeklySale.groupBy({
        by: ["weekStart"],
        _sum: { amount: true },
        where: {
          weekStart: { in: weekStarts },
          status: { not: WeeklySaleStatus.REJECTED },
          ...(accountId
            ? { shopId: { in: shopIdsForWeeklySales.length ? shopIdsForWeeklySales : ["__none__"] } }
            : {}),
        },
        orderBy: { weekStart: "asc" },
      }),
      (prisma as any).marketplaceProfitEntry.groupBy({
        by: ["weekStart"],
        _count: { _all: true },
        where: {
          weekStart: { in: weekStarts },
          periodKey: period.key,
          buyingPrice: { lte: 0 },
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

      perWeekWeeklySales = await (prisma as any).weeklySale.groupBy({
        by: ["weekStart"],
        _sum: { amount: true },
        where: {
          weekStart: { in: weekStarts },
          status: { not: WeeklySaleStatus.REJECTED },
        },
        orderBy: { weekStart: "asc" },
      });

      perWeekMissingPricing = await (prisma as any).marketplaceProfitEntry.groupBy({
        by: ["weekStart"],
        _count: { _all: true },
        where: {
          weekStart: { in: weekStarts },
          periodKey: period.key,
          buyingPrice: { lte: 0 },
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
  const weeklySaleMap = new Map(
    (perWeekWeeklySales as any[]).map((row) => [new Date(row.weekStart).toISOString(), Number(row._sum?.amount ?? 0)]),
  );
  const missingPricingMap = new Map(
    (perWeekMissingPricing as any[]).map((row) => [new Date(row.weekStart).toISOString(), Number(row._count?._all ?? 0)]),
  );
  const totalAccountsForCoverage = accountId ? 1 : accounts.length;
  const completionSummaries = accountId
    ? await Promise.all(weeks.map((wk) => getPricingWeekSummary(wk.startInput, { accountIds: [accountId] })))
    : await Promise.all(weeks.map((wk) => getPricingWeekSummary(wk.startInput)));
  const completionSummaryMap = new Map(completionSummaries.map((summary) => [summary.week_start, summary]));
  const operatingCapitalSummaries = await Promise.all(
    weeks.map(async (wk) => {
      const completion = completionSummaryMap.get(wk.startInput);
      if (!completion) return [wk.startInput, null] as const;
      const agg = aggMap.get(wk.weekStart.toISOString()) ?? { netPayout: 0, profit: 0, avgCommissionRate: 0 };
      const weeklyNet = weeklySaleMap.get(wk.weekStart.toISOString()) ?? null;
      const currentNetPayout =
        typeof completion.total_net_payout === "number" && Number.isFinite(completion.total_net_payout)
          ? completion.total_net_payout
          : typeof weeklyNet === "number" && Number.isFinite(weeklyNet) && weeklyNet !== 0
            ? weeklyNet
            : agg.netPayout;
      const profitForCapital =
        typeof completion.net_profit === "number" && Number.isFinite(completion.net_profit)
          ? completion.net_profit
          : agg.profit;
      const summary = await getOperatingCapitalSummary({
        weekStartRaw: wk.startInput,
        periodKey: period.key,
        completionSummary: completion,
        profit: profitForCapital,
        currentNetPayout,
        accountId: accountId || null,
        actorId,
      });
      return [wk.startInput, summary] as const;
    }),
  );
  const operatingCapitalSummaryMap = new Map(operatingCapitalSummaries);
  const successLogs = await prisma.actionLog.findMany({
    where: {
      entity: PRICING_WEEK_ENTITY,
      action: PRICING_WEEK_SUCCESS_ACTION,
      entityId: { in: weeks.map((wk) => wk.startInput) },
    },
    select: { entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const sentWeekMap = new Map<string, string>();
  for (const row of successLogs) {
    const key = String(row.entityId ?? "").trim();
    if (!key || sentWeekMap.has(key)) continue;
    sentWeekMap.set(key, row.createdAt.toISOString());
  }

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
            <p className="text-sm text-slate-400">
              Net payout comes from loaded weekly statements (CSV/manual weekly). Profit, loss entries, and commission rates update as buying
              prices are submitted.
            </p>
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
            const weeklyNet = weeklySaleMap.get(wk.weekStart.toISOString()) ?? null;
            const weekHref = `/admin/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}#missing-pricing`;
            const completion = completionSummaryMap.get(wk.startInput) ?? null;
            const operatingCapital = operatingCapitalSummaryMap.get(wk.startInput) ?? null;
            const netToShow =
              completion && typeof completion.total_net_payout === "number" && Number.isFinite(completion.total_net_payout)
                ? completion.total_net_payout
                : typeof weeklyNet === "number" && Number.isFinite(weeklyNet) && weeklyNet !== 0
                  ? weeklyNet
                  : agg.netPayout;
            const profitToShow =
              completion && typeof completion.net_profit === "number" && Number.isFinite(completion.net_profit)
                ? completion.net_profit
                : agg.profit;
            const avgCommissionToShow =
              completion && typeof completion.avg_commission_pct === "number" && Number.isFinite(completion.avg_commission_pct)
                ? completion.avg_commission_pct
                : agg.avgCommissionRate;
            const lossCount = completion?.loss_entries ?? (lossMap.get(wk.weekStart.toISOString()) ?? 0);
            const submittedAccounts = completion?.accounts_completed ?? 0;
            const totalAccounts = completion?.accounts_total ?? totalAccountsForCoverage;
            const missingPricingCount = completion?.missing_pricing ?? (missingPricingMap.get(wk.weekStart.toISOString()) ?? 0);
            const notSubmittedAccounts = completion ? Math.max(0, totalAccounts - submittedAccounts) : 0;
            const notLoadedAccounts = completion
              ? completion.accounts.filter((account) => !account.markedZero && !account.hasDraft && !account.hasProfitEntries).length
              : 0;
            const submittedHref = `/admin/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}&accountStatus=submitted#account-status`;
            const notSubmittedHref = `/admin/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}&accountStatus=not-submitted#account-status`;
            const notLoadedHref = `/admin/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}&accountStatus=not-loaded#account-status`;
            const sentAt = sentWeekMap.get(wk.startInput) ?? null;
            return (
              <div
                key={wk.key}
                className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">Week</p>
                <p className="mt-1 text-sm font-semibold text-white">{wk.label}</p>
                {limitedView ? (
                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Loss entries</span>
                      <span className="font-semibold text-amber-200">{lossCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Accounts submitted</span>
                      <Link href={submittedHref} className="font-semibold text-slate-100 hover:text-emerald-200">
                        {submittedAccounts}/{totalAccounts}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Missing pricing</span>
                      <span className={`font-semibold ${missingPricingCount > 0 ? "text-rose-300" : "text-emerald-200"}`}>
                        {missingPricingCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Accounts not submitted</span>
                      <Link href={notSubmittedHref} className="font-semibold text-amber-200 hover:text-amber-100">
                        {notSubmittedAccounts}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Accounts not loaded</span>
                      <Link href={notLoadedHref} className="font-semibold text-rose-300 hover:text-rose-200">
                        {notLoadedAccounts}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500">Totals hidden for supervisor view. Open week to see per-order profit/loss.</div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Net payout after deduction</span>
                      <span className="font-semibold text-emerald-300">
                        {currency.format(operatingCapital?.adjustedNetPayout ?? netToShow)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Profit</span>
                      <span className={`font-semibold ${profitToShow < 0 ? "text-red-300" : "text-emerald-200"}`}>
                        {currency.format(profitToShow)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{operatingCapital?.label ?? "Estimated operating capital"}</span>
                      <span className="font-semibold text-slate-100">
                        {currency.format(operatingCapital?.operatingCapital ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Operating capital status</span>
                      <span className={`font-semibold ${operatingCapital?.isFinal ? "text-emerald-200" : "text-amber-200"}`}>
                        {operatingCapital?.statusLabel ?? "Estimated"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Loss entries</span>
                      <span className="font-semibold text-amber-200">{lossCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Avg commission %</span>
                      <span className="font-semibold text-slate-200">{avgCommissionToShow.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Accounts submitted</span>
                      <Link href={submittedHref} className="font-semibold text-slate-100 hover:text-emerald-200">
                        {submittedAccounts}/{totalAccounts}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Missing pricing</span>
                      <span className={`font-semibold ${missingPricingCount > 0 ? "text-rose-300" : "text-emerald-200"}`}>
                        {missingPricingCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Accounts not submitted</span>
                      <Link href={notSubmittedHref} className="font-semibold text-amber-200 hover:text-amber-100">
                        {notSubmittedAccounts}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Accounts not loaded</span>
                      <Link href={notLoadedHref} className="font-semibold text-rose-300 hover:text-rose-200">
                        {notLoadedAccounts}
                      </Link>
                    </div>
                    {completion ? (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Accounts marked zero</span>
                        <span className="font-semibold text-slate-200">{completion.accounts_zero}</span>
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <Link href={weekHref} className="text-slate-400 hover:text-slate-200">
                      Drill-down: <span className="font-semibold text-emerald-200">Open missing pricing list</span>
                    </Link>
                    <PricingWeekWhatsappButton weekStart={wk.startInput} defaultSent={Boolean(sentAt)} />
                  </div>
                  {sentAt ? (
                    <p className="mt-2 text-[11px] text-emerald-300">
                      WhatsApp sent on {new Date(sentAt).toLocaleString("en-KE")}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Notes</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          <li>- Net payout is loaded via weekly statements (CSV) or manual weekly totals.</li>
          <li>- Operating capital is 50% of profit, rounded to whole Kenya shillings, and deducted from displayed payout.</li>
          <li>- Net payout = item credit + commission + shipping (commission/shipping stored as negative).</li>
          <li>- Profit = net payout - buying price.</li>
          <li>- Accounts submitted includes fully priced accounts plus accounts marked zero.</li>
        </ul>
      </section>
    </div>
  );
}
