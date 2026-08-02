import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import WeekProfitEntriesClient from "@/app/admin/online/performance/_components/WeekProfitEntries.client";
import { resolveShopIdsForMarketplaceAccount } from "@/lib/marketplaceAccountShopResolve";
import { getPricingWeekSummary, type PricingWeekAccountStatus } from "@/lib/pricingWeekWhatsapp";
import { getOperatingCapitalSummary, resolveOperatingCapitalSummaryInputs } from "@/lib/operatingCapital";
import OperatingCapitalAdminCard from "@/app/admin/online/performance/_components/OperatingCapitalAdminCard.client";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type SearchParams = { weekStart?: string; periodKey?: string; accountId?: string; accountStatus?: string };

function getAccountSubmissionStatus(account: PricingWeekAccountStatus) {
  if (account.markedZero) return "ZERO";
  if (account.complete) return "DONE";
  if (account.hasDraft || account.hasProfitEntries) return "LOADED";
  return "NOT LOADED";
}

export default async function OnlinePerformanceWeekPage({
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
  const accountStatusFilter = String(resolved.accountStatus ?? "all").trim().toLowerCase();

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
  const completion = await getPricingWeekSummary(weekStartRaw, accountId ? { accountIds: [accountId] } : undefined);

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
  const { currentNetPayout: grossSalesBeforeDeduction, profit: profitForCapital } = resolveOperatingCapitalSummaryInputs({
    completionSummary: completion,
    fallbackCurrentNetPayout: manualWeeklyTotal !== 0 ? manualWeeklyTotal : totalNet,
    fallbackProfit: totalProfit,
  });
  const avgCommissionToShow =
    typeof completion.avg_commission_pct === "number" && Number.isFinite(completion.avg_commission_pct)
      ? completion.avg_commission_pct
      : avgCommission;
  const profitToShow =
    typeof completion.net_profit === "number" && Number.isFinite(completion.net_profit)
      ? completion.net_profit
      : totalProfit;
  const operatingCapital = await getOperatingCapitalSummary({
    weekStartRaw,
    periodKey: period.key,
    completionSummary: completion,
    profit: profitForCapital,
    currentNetPayout: grossSalesBeforeDeduction,
    accountId: accountId || null,
    actorId,
  });

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
  const missingPricingRows = rows.filter((e) => Number(e.buyingPrice ?? 0) <= 0);
  const missingPricingCount = missingPricingRows.length;
  const accountRows = completion.accounts.map((account) => ({
    ...account,
    status: getAccountSubmissionStatus(account),
  }));
  const filteredAccounts = accountRows.filter((account) => {
    switch (accountStatusFilter) {
      case "submitted":
        return account.complete;
      case "not-submitted":
        return !account.complete;
      case "not-loaded":
        return account.status === "NOT LOADED";
      case "loaded":
        return account.status === "LOADED";
      case "zero":
        return account.status === "ZERO";
      default:
        return true;
    }
  });
  const filterHref = (filter: string) =>
    `/admin/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(weekStartRaw)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}&accountStatus=${encodeURIComponent(filter)}#account-status`;

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
              <p className="text-xs uppercase tracking-wide text-slate-400">Gross sales before deduction</p>
              <p className="mt-2 text-xl font-semibold text-white">{currency.format(operatingCapital.grossSalesBeforeDeduction)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Profit</p>
              <p className={`mt-2 text-xl font-semibold ${profitToShow < 0 ? "text-red-300" : "text-emerald-200"}`}>
                {currency.format(profitToShow)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Loss entries</p>
              <p className="mt-2 text-xl font-semibold text-amber-200">{lossCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{operatingCapital.label}</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{currency.format(operatingCapital.operatingCapital)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Net payout after deduction</p>
              <p className="mt-2 text-xl font-semibold text-emerald-300">
                {currency.format(operatingCapital.netPayoutAfterDeduction)}
              </p>
            </div>
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
              <p className="mt-2 text-xl font-semibold text-slate-100">{avgCommissionToShow.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Gross sales before deduction (source)</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{currency.format(grossSalesBeforeDeduction)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Operating capital status</p>
              <p className={`mt-2 text-xl font-semibold ${operatingCapital.isFinal ? "text-emerald-200" : "text-amber-200"}`}>
                {operatingCapital.statusLabel}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Products missing pricing</p>
              <p className={`mt-2 text-xl font-semibold ${missingPricingCount > 0 ? "text-rose-300" : "text-emerald-200"}`}>
                {missingPricingCount}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Entries</h2>
          <p className="text-sm text-slate-400">Totals hidden for supervisor view. Review profit per order below.</p>
        </section>
      )}

      {role === "ADMIN" ? (
        <OperatingCapitalAdminCard
          weekStart={weekStartRaw}
          periodKey={period.key}
          accountId={accountId || null}
          canFinalize={operatingCapital.canFinalize}
          isFinal={operatingCapital.isFinal}
        />
      ) : null}

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

      <section id="account-status" className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Account submission status</h2>
            <p className="text-sm text-slate-400">
              Accounts submitted includes fully priced accounts plus accounts marked zero.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Link
              href={filterHref("all")}
              className={`rounded-full border px-3 py-1.5 ${
                accountStatusFilter === "all" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              All ({accountRows.length})
            </Link>
            <Link
              href={filterHref("submitted")}
              className={`rounded-full border px-3 py-1.5 ${
                accountStatusFilter === "submitted" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              Submitted ({accountRows.filter((account) => account.complete).length})
            </Link>
            <Link
              href={filterHref("not-submitted")}
              className={`rounded-full border px-3 py-1.5 ${
                accountStatusFilter === "not-submitted" ? "border-amber-400/50 bg-amber-500/10 text-amber-200" : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              Not submitted ({accountRows.filter((account) => !account.complete).length})
            </Link>
            <Link
              href={filterHref("not-loaded")}
              className={`rounded-full border px-3 py-1.5 ${
                accountStatusFilter === "not-loaded" ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              Not loaded ({accountRows.filter((account) => account.status === "NOT LOADED").length})
            </Link>
            <Link
              href={filterHref("zero")}
              className={`rounded-full border px-3 py-1.5 ${
                accountStatusFilter === "zero" ? "border-slate-400/50 bg-slate-500/10 text-slate-100" : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              Zero ({accountRows.filter((account) => account.status === "ZERO").length})
            </Link>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Required rows</th>
                <th className="py-2 pr-4 text-right">Submitted rows</th>
                <th className="py-2 pr-4 text-right">Missing pricing</th>
                <th className="py-2 pr-4">Open</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.accountId} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-slate-100">{account.displayName}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                        account.status === "DONE"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : account.status === "ZERO"
                            ? "border-slate-400/40 bg-slate-500/10 text-slate-100"
                            : account.status === "LOADED"
                              ? "border-sky-400/40 bg-sky-500/10 text-sky-200"
                              : "border-rose-400/40 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      {account.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-200">{account.requiredRowCount}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{account.submittedCount}</td>
                  <td className={`py-3 pr-4 text-right font-semibold ${account.missingPricing > 0 ? "text-rose-300" : "text-emerald-200"}`}>
                    {account.missingPricing}
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={
                        account.shopIds[0]
                          ? `/admin/online/performance/capture?shopId=${encodeURIComponent(account.shopIds[0])}&weekStart=${encodeURIComponent(weekStartRaw)}`
                          : "/admin/online/performance/capture"
                      }
                      className="text-emerald-200 hover:text-emerald-100"
                    >
                      Open capture
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    No accounts match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section id="missing-pricing" className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Products missing pricing</h2>
            <p className="text-sm text-slate-400">Rows where buying price is zero. Price these to complete weekly profit capture.</p>
          </div>
          <Link
            href="/admin/online/performance/capture"
            className="rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
          >
            Open capture page
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Shop</th>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Txn</th>
                <th className="py-2 pr-4 text-right">Net payout</th>
                <th className="py-2 pr-4 text-right">Buying</th>
              </tr>
            </thead>
            <tbody>
              {missingPricingRows.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-slate-200">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-slate-200">{row.shopName || "-"}</td>
                  <td className="py-3 pr-4 text-slate-200">{row.orderId || "-"}</td>
                  <td className="py-3 pr-4 text-slate-100">{row.productName || "-"}</td>
                  <td className="py-3 pr-4 text-slate-300">{row.sku || "-"}</td>
                  <td className="py-3 pr-4 font-medium text-emerald-200">{row.itemCreditTxn || "-"}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(row.netPayout ?? 0))}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-rose-300">{currency.format(Number(row.buyingPrice ?? 0))}</td>
                </tr>
              ))}
              {missingPricingRows.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={8}>
                    No missing pricing rows for this week.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
