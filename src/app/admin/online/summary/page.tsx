import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform, Prisma, MarketplaceReturnStatus } from "@prisma/client";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildUtcWeekStartIso, canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logInfo } from "@/lib/logging";
import { chooseAuthoritativeCandidate } from "@/lib/payoutDeduper";
import JumiaWeeksLive from '@/components/JumiaWeeksLive.client';

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-KE");

const dateOnlyISO = (d: Date) => d.toISOString().slice(0, 10);
const normalizeWeekDate = (date: Date) => parseDateOnlyUtc(dateOnlyISO(date)) ?? date;
const isPlaceholderRow = (row: any) => row?.rawPayload?.placeholder === true;

type ReturnGroup = { status: MarketplaceReturnStatus; _count: { _all: number } };

const makeEmptyPayoutAgg = () => ({
  _sum: { grossSales: new Prisma.Decimal(0), payoutAmount: new Prisma.Decimal(0) },
  _count: { _all: 0 },
});
const makeEmptyOrdersAgg = () => ({
  _sum: { sellingPrice: new Prisma.Decimal(0) },
  _count: { _all: 0 },
});

export default async function AdminOnlineSummaryPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const period = getTradingPeriodFor(new Date());
  const now = new Date();

  const warnings: string[] = [];

  const safe = async <T,>(label: string, fallback: () => T, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      console.error(`[admin/online/summary] Failed to load ${label}:`, err);
      warnings.push(label);
      return fallback();
    }
  };

  const [
    accountCount,
    activeAssignments,
    payoutAgg,
    ordersAgg,
    unpricedOrders,
    returnsOpen,
    returnsByStatusRaw,
  ] = await Promise.all([
    safe("account count", () => 0, () =>
      prisma.marketplaceAccount.count(),
    ),
    safe("assignment count", () => 0, () =>
      prisma.marketplaceAccountAssignment.count({
        where: {
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      }),
    ),
    safe("payout stats", makeEmptyPayoutAgg, () =>
      prisma.marketplacePayoutWeek.aggregate({
        _sum: { grossSales: true, payoutAmount: true },
        _count: { _all: true },
        where: {
          weekEnd: {
            gte: period.start,
            lte: period.end,
          },
        },
      }),
    ),
    safe("order stats", makeEmptyOrdersAgg, () =>
      prisma.marketplaceOrder.aggregate({
        _count: { _all: true },
        _sum: { sellingPrice: true },
        where: {
          orderedAt: {
            gte: period.start,
            lte: period.end,
          },
        },
      }),
    ),
    safe("unpriced orders count", () => 0, () =>
      prisma.marketplaceOrder.count({ where: { buyingPrice: null } }),
    ),
    safe("pending returns count", () => 0, () =>
      prisma.marketplaceReturn.count({ where: { status: "WAITING_AT_HUB" } }),
    ),
    safe("returns grouped by status", () => [] as ReturnGroup[], async () => {
      const data = await prisma.marketplaceReturn.groupBy({
        by: ["status"],
        _count: { _all: true },
      });
      return data.map((entry: any) => ({
        status: entry.status,
        _count: { _all: entry._count._all },
      }));
    }),
  ]);

  const returnsByStatus = returnsByStatusRaw;

  const ordersCount =
    ordersAgg._count && typeof ordersAgg._count !== "boolean"
      ? ordersAgg._count._all ?? 0
      : 0;
  const payoutStatementCount =
    payoutAgg._count && typeof payoutAgg._count !== "boolean"
      ? payoutAgg._count._all ?? 0
      : 0;

  const cards = [
    { label: "Active accounts", value: accountCount },
    { label: "Active assignments", value: activeAssignments },
    {
      label: "Marketplace gross sales (period)",
      value: currencyFormatter.format(Number(payoutAgg._sum?.grossSales ?? 0)),
    },
    {
      label: "Orders synced (period)",
      value: numberFormatter.format(ordersCount),
    },
    { label: "Unpriced orders", value: unpricedOrders },
    { label: "Returns waiting at hub", value: returnsOpen },
  ];

  // Aggregate payouts by canonical week window (grouped per account + week) to avoid duplicate rows
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - 90);
  const recentPayouts = await prisma.marketplacePayoutWeek.findMany({
    where: {
      account: { platform: "JUMIA" },
      weekEnd: { gte: lookbackDate },
    },
    select: {
      accountId: true,
      weekStart: true,
      weekEnd: true,
      statementNumber: true,
      rawPayload: true,
      grossSales: true,
      payoutAmount: true,
    },
  });

  const weekBucket = new Map<
    string,
    {
      weekStart: Date;
      weekEnd: Date;
      accounts: Map<string, (typeof recentPayouts)[number][]>;
    }
  >();

  for (const row of recentPayouts) {
    const { weekStart: canonicalStart, weekEnd: canonicalEnd } = mondayToSundayNairobiWindow(new Date(row.weekStart));
    const key = canonicalStart.toISOString();
    if (!weekBucket.has(key)) {
      weekBucket.set(key, {
        weekStart: canonicalStart,
        weekEnd: canonicalEnd,
        accounts: new Map(),
      });
    }
    const entry = weekBucket.get(key)!;
    const bucket = entry.accounts.get(row.accountId) ?? [];
    bucket.push(row);
    entry.accounts.set(row.accountId, bucket);
  }

  const allAccounts = await prisma.marketplaceAccount.findMany({
    where: { platform: Platform.JUMIA, isActive: true },
    select: { id: true },
  });
  const totalActiveAccounts = allAccounts.length;

  const enrichedWeeks = Array.from(weekBucket.values()).map((entry) => {
    const bestRows = Array.from(entry.accounts.values())
      .map((rows) => {
        const nonPlaceholder = rows.filter((row) => !isPlaceholderRow(row));
        const candidates = nonPlaceholder.length ? nonPlaceholder : rows;
        return chooseAuthoritativeCandidate(candidates as any, entry.weekStart);
      })
      .filter(Boolean) as any[];
    const realRows = bestRows.filter((row) => !isPlaceholderRow(row));
    const placeholderRows = bestRows.filter((row) => isPlaceholderRow(row));
    const present = realRows.length;
    const missing = Math.max(totalActiveAccounts - present, 0);
    const gross = bestRows.reduce((sum, row) => sum + Number(row?.grossSales ?? 0), 0);
    const totalRealPayout = realRows.reduce(
      (sum, row) => sum + Number(row?.payoutAmount ?? row?.grossSales ?? 0),
      0,
    );
    const totalPlaceholderPayout = placeholderRows.reduce(
      (sum, row) => sum + Number(row?.payoutAmount ?? row?.grossSales ?? 0),
      0,
    );
    const displayPayout = totalRealPayout > 0 ? totalRealPayout : totalPlaceholderPayout;
    // Adjust week end for display by subtracting the Nairobi UTC offset (3 hours)
    const displayEnd = new Date(entry.weekEnd.getTime() - 3 * 60 * 60 * 1000);
    return {
      period: { start: entry.weekStart, end: entry.weekEnd },
      _sum: { grossSales: gross, payoutAmount: displayPayout },
      // Count only real rows as present; placeholders are missing.
      accountCount: present,
      missingCount: missing,
      label: `${formatNairobiDate(entry.weekStart)} – ${formatNairobiDate(displayEnd)}`,
      realRowCount: realRows.length,
      placeholderRowCount: placeholderRows.length,
      totalRealPayout,
      totalPlaceholderPayout,
      displayPayout,
    };
  });

  const sortedWeeks = enrichedWeeks.sort((a, b) => (a.period.start < b.period.start ? 1 : -1));
  const currentWeekEntry = sortedWeeks[0];
  const recentWeeksEnriched = sortedWeeks.slice(0, 8);

  if (currentWeekEntry) {
    const { weekStart: normalizedStart, weekEnd: normalizedEnd } = mondayToSundayNairobiWindow(
      currentWeekEntry.period.start,
    );
    const weeklySaleAgg = await prisma.weeklySale.aggregate({
      _sum: { amount: true },
      where: {
        weekStart: normalizedStart,
        weekEnd: normalizedEnd,
      },
    });
    const totalWeeklySale = Number(weeklySaleAgg._sum?.amount ?? 0);
    logInfo("[weekCard] payout breakdown", {
      weekStart: currentWeekEntry.period.start.toISOString(),
      weekEnd: currentWeekEntry.period.end.toISOString(),
      totalRealPayout: currentWeekEntry.totalRealPayout,
      totalPlaceholderPayout: currentWeekEntry.totalPlaceholderPayout,
      totalWeeklySale,
      realRowCount: currentWeekEntry.realRowCount,
      placeholderRowCount: currentWeekEntry.placeholderRowCount,
      presentAccounts: currentWeekEntry.accountCount,
      missingAccounts: currentWeekEntry.missingCount,
    });
  }

  return (
    <div className="space-y-8">
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
          <p className="font-semibold">Some marketplace metrics are unavailable right now.</p>
          <p className="mt-1 text-sm text-amber-200">
            {warnings.join(", ")}. This usually means the latest database migrations haven&apos;t been applied yet or the nightly sync job hasn&apos;t populated
            data for this environment. Other metrics are still shown below.
          </p>
        </div>
      )}
      <section>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Current trading period • {period.label}
        </p>
        <h2 className="text-xl font-semibold mt-1">Operational snapshot</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 shadow-inner shadow-black/40"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Payout weeks</h3>
            <p className="text-sm text-slate-400">Click a week to view per-account payout amounts (paid & unpaid).</p>
          </div>
        </div>
        <JumiaWeeksLive initialData={recentWeeksEnriched.slice(0, 8)} totalActiveAccounts={totalActiveAccounts} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Marketplace payout weeks</h3>
            <p className="text-sm text-slate-400">
              {payoutStatementCount} statements synced between {period.start.toLocaleDateString()} and{" "}
              {period.end.toLocaleDateString()}.
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Gross sales</dt>
            <dd className="mt-2 text-xl font-semibold text-emerald-300">
              {currencyFormatter.format(Number(payoutAgg._sum?.grossSales ?? 0))}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Payout amounts</dt>
            <dd className="mt-2 text-xl font-semibold text-emerald-300">
              {currencyFormatter.format(Number(payoutAgg._sum?.payoutAmount ?? 0))}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Statements counted</dt>
            <dd className="mt-2 text-xl font-semibold text-white">
              {numberFormatter.format(payoutStatementCount)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Return cases by status</h3>
            <p className="text-sm text-slate-400">
              Live snapshot of marketplace return cases and their current status groupings.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Cases</th>
              </tr>
            </thead>
            <tbody>
              {returnsByStatus.map((entry: any) => (
                <tr key={entry.status} className="border-t border-white/5">
                  <td className="py-3 pr-4 font-medium text-white">
                    {entry.status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </td>
                  <td className="py-3 pr-4 text-right text-emerald-200">
                    {numberFormatter.format(entry._count._all)}
                  </td>
                </tr>
              ))}
              {!returnsByStatus.length && (
                <tr>
                  <td className="py-3 pr-4 text-slate-400" colSpan={2}>
                    No return cases available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Manual weekly sales</h3>
            <p className="text-sm text-slate-400">
              Review marketplace overrides, add manual entries, and approve payouts captured outside the sync job.
            </p>
          </div>
          <Link
            href="/admin/online/manual"
            className="inline-flex items-center justify-center rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
          >
            Open manual sales desk
          </Link>
        </div>
      </section>
    </div>
  );
}
