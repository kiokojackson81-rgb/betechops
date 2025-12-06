import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, MarketplaceReturnStatus } from "@prisma/client";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-KE");

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

  return (
    <div className="space-y-8">
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
          <p className="font-semibold">Some marketplace metrics are unavailable right now.</p>
          <p className="mt-1 text-sm text-amber-200">
            {warnings.join(", ")}. This usually means the latest database migrations haven't been applied yet or the nightly sync job hasn't populated
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
    </div>
  );
}
