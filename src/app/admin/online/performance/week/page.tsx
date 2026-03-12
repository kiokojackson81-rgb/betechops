import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import WeekProfitEntriesClient from "@/app/admin/online/performance/_components/WeekProfitEntries.client";
import { resolveShopIdsForMarketplaceAccount } from "@/lib/marketplaceAccountShopResolve";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type SearchParams = { weekStart?: string; periodKey?: string; accountId?: string };

export default async function OnlinePerformanceWeekPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const email = String((session?.user as any)?.email ?? "").toLowerCase();
  const isBenjamin = email === "benjamin@betech.co.ke";
  const limitedView = isBenjamin && role !== "ADMIN";
  if (role !== "ADMIN" && role !== "SUPERVISOR" && !isBenjamin) {
    return redirect("/not-authorized");
  }

  const resolved = await Promise.resolve(searchParams ?? {});
  const period = parseTradingPeriodKey(resolved.periodKey) ?? getTradingPeriodFor(new Date());
  const accountId = (resolved.accountId ?? "").trim();

  const weekStartRaw = (resolved.weekStart ?? "").trim();
  const parsed = weekStartRaw ? parseDateOnlyUtc(weekStartRaw) : null;
  if (!parsed) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-white">Week performance</h1>
        <p className="text-sm text-slate-400">Missing `weekStart` query parameter.</p>
        <Link href={`/admin/online/performance?periodKey=${encodeURIComponent(period.key)}`} className="text-emerald-200 hover:text-emerald-100">
          Back to performance
        </Link>
      </div>
    );
  }

  const canonicalStart = canonicalNairobiWeekStartUtc(parsed);
  const window = mondayToSundayNairobiWindow(canonicalStart);
  const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);

  const shopIdsForWeeklySales = accountId ? await resolveShopIdsForMarketplaceAccount(accountId) : [];

  const manualWeeklyAgg = await prisma.weeklySale.aggregate({
    _sum: { amount: true },
    where: {
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      source: WeeklySaleSource.MANUAL,
      status: { not: WeeklySaleStatus.REJECTED },
      ...(accountId ? { shopId: { in: shopIdsForWeeklySales.length ? shopIdsForWeeklySales : ["__none__"] } } : {}),
    },
  });

  let entries: any[] = [];
  let agg: any = {};
  let lossCount = 0;
  let dbReady = true;
  let isLossColumnReady = true;
  let accountIdColumnReady = true;
  try {
    const [e, a, lc] = await Promise.all([
      (prisma as any).marketplaceProfitEntry.findMany({
        where: {
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          periodKey: period.key,
          ...(accountId ? { accountId } : {}),
          ...(limitedView ? { enteredByAdminId: (session?.user as any)?.id } : {}),
        },
        select: {
          id: true,
          date: true,
          platform: true,
          accountId: true,
          itemCreditTxn: true,
          itemCreditAmount: true,
          commissionAmount: true,
          shippingAmount: true,
          netPayout: true,
          buyingPrice: true,
          profit: true,
          isLoss: true,
          orderId: true,
          sku: true,
          productName: true,
          account: { select: { displayName: true } },
          enteredByAdmin: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ profit: "asc" }, { date: "asc" }],
      }),
      (prisma as any).marketplaceProfitEntry.aggregate({
        _sum: { itemCreditAmount: true, netPayout: true, buyingPrice: true, profit: true },
        _avg: { commissionRatePct: true, marginPct: true },
        where: {
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          periodKey: period.key,
          ...(accountId ? { accountId } : {}),
          ...(limitedView ? { enteredByAdminId: (session?.user as any)?.id } : {}),
        },
      }),
      (prisma as any).marketplaceProfitEntry.count({
        where: {
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          periodKey: period.key,
          isLoss: true,
          ...(accountId ? { accountId } : {}),
          ...(limitedView ? { enteredByAdminId: (session?.user as any)?.id } : {}),
        },
      }),
    ]);
    entries = e;
    agg = a;
    lossCount = Number(lc ?? 0);
  } catch (err: any) {
    if (err?.code === "P2021") {
      dbReady = false;
      entries = [];
      agg = {};
      lossCount = 0;
    } else if (err?.code === "P2022") {
      isLossColumnReady = false;
      if (accountId) accountIdColumnReady = false;
      const [e, a, lc] = await Promise.all([
        (prisma as any).marketplaceProfitEntry.findMany({
          where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key },
          select: {
            id: true,
            date: true,
            platform: true,
            itemCreditTxn: true,
            itemCreditAmount: true,
            commissionAmount: true,
            shippingAmount: true,
            netPayout: true,
            buyingPrice: true,
            profit: true,
            orderId: true,
            sku: true,
            productName: true,
            enteredByAdmin: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ profit: "asc" }, { date: "asc" }],
        }),
        (prisma as any).marketplaceProfitEntry.aggregate({
          _sum: { itemCreditAmount: true, netPayout: true, buyingPrice: true, profit: true },
          _avg: { commissionRatePct: true, marginPct: true },
          where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key },
        }),
        (prisma as any).marketplaceProfitEntry.count({
          where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key, profit: { lt: 0 } },
        }),
      ]);
      entries = e;
      agg = a;
      lossCount = Number(lc ?? 0);
    } else {
      throw err;
    }
  }

  const typedAgg = agg as any;
  const totalRevenue = Number(typedAgg?._sum?.itemCreditAmount ?? 0);
  const totalNet = Number(typedAgg?._sum?.netPayout ?? 0);
  const totalBuying = Number(typedAgg?._sum?.buyingPrice ?? 0);
  const totalProfit = Number(typedAgg?._sum?.profit ?? 0);
  const avgCommission = Number(typedAgg?._avg?.commissionRatePct ?? 0);
  const avgMargin = Number(typedAgg?._avg?.marginPct ?? 0);
  const manualWeeklyTotal = Number(manualWeeklyAgg._sum.amount ?? 0);
  const netToShow = manualWeeklyTotal !== 0 ? manualWeeklyTotal : totalNet;

  const rows = (entries as any[]).map((e) => ({
    id: String(e.id),
    date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
    platform: e.platform,
    itemCreditTxn: String(e.itemCreditTxn ?? ""),
    shopName: String(e.account?.displayName ?? ""),
    orderId: String(e.orderId ?? ""),
    sku: String(e.sku ?? ""),
    productName: String(e.productName ?? ""),
    itemCreditAmount: Number(e.itemCreditAmount ?? 0),
    commissionAmount: Number(e.commissionAmount ?? 0),
    shippingAmount: Number(e.shippingAmount ?? 0),
    netPayout: Number(e.netPayout ?? 0),
    buyingPrice: Number(e.buyingPrice ?? 0),
    profit: Number(e.profit ?? 0),
    enteredBy: e.enteredByAdmin?.name || e.enteredByAdmin?.email || "-",
    isLoss: Boolean(e.isLoss),
  }));

  const lossEntries = rows.filter((e) => Number(e.profit ?? 0) < 0);
  const lossEntriesFlagged = rows.filter((e) => Boolean((e as any).isLoss));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Week performance</h1>
        <p className="text-sm text-slate-400">
          {formatNairobiDate(window.weekStart)} – {formatNairobiDate(endInclusive)} (Trading period: {period.label})
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/admin/online/performance?periodKey=${encodeURIComponent(period.key)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            Back to performance
          </Link>
          <Link
            href="/admin/online/performance/capture"
            className="rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
          >
            Capture profit
          </Link>
        </div>
      </header>

      {!limitedView ? (
        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">KPIs</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Revenue (item credit)</p>
              <p className="mt-2 text-xl font-semibold text-white">{currency.format(totalRevenue)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Net payout</p>
              <p className="mt-2 text-xl font-semibold text-emerald-300">{currency.format(netToShow)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Profit</p>
              <p className={`mt-2 text-xl font-semibold ${totalProfit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                {currency.format(totalProfit)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Loss entries</p>
              <p className="mt-2 text-xl font-semibold text-amber-200">{lossCount}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Buying total</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{currency.format(totalBuying)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg margin %</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{avgMargin.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg commission %</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{avgCommission.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Statement net payout</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{currency.format(manualWeeklyTotal)}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Entries</h2>
          <p className="text-sm text-slate-400">Totals hidden for supervisor view. Review profit per order below.</p>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Loss entries</h2>
        <p className="text-sm text-slate-400">Profit &lt; 0.</p>
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

        <div className="mt-4">
          <WeekProfitEntriesClient
            rows={(lossEntriesFlagged.length ? lossEntriesFlagged : lossEntries) as any}
            emptyText="No loss entries for this week."
            variant="loss"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">All entries</h2>
        <div className="mt-4">
          <WeekProfitEntriesClient rows={rows as any} emptyText="No profit entries captured for this week." variant="all" enableBulkDelete />
        </div>
      </section>
    </div>
  );
}
