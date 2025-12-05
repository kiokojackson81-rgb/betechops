import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-KE");

export default async function AdminOnlineSummaryPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const period = getTradingPeriodFor(new Date());
  const now = new Date();

  const [accountCount, activeAssignments, payoutAgg, ordersAgg, unpricedOrders, returnsOpen, returnsByStatus] =
    await Promise.all([
      prisma.marketplaceAccount.count(),
      prisma.marketplaceAccountAssignment.count({
        where: {
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      }),
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
      prisma.marketplaceOrder.count({
        where: { buyingPrice: null },
      }),
      prisma.marketplaceReturn.count({
        where: { status: "WAITING_AT_HUB" },
      }),
      prisma.marketplaceReturn.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

  const cards = [
    { label: "Active accounts", value: accountCount },
    { label: "Active assignments", value: activeAssignments },
    {
      label: "Marketplace gross sales (period)",
      value: currencyFormatter.format(Number(payoutAgg._sum?.grossSales ?? 0)),
    },
    {
      label: "Orders synced (period)",
      value: numberFormatter.format(ordersAgg._count?._all ?? 0),
    },
    { label: "Unpriced orders", value: unpricedOrders },
    { label: "Returns waiting at hub", value: returnsOpen },
  ];

  return (
    <div className="space-y-8">
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
              {payoutAgg._count?._all ?? 0} statements synced between {period.start.toLocaleDateString()} and{" "}
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
              {numberFormatter.format(payoutAgg._count?._all ?? 0)}
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
              {returnsByStatus.map((entry) => (
                <tr key={entry.status} className="border-t border-white/5">
                  <td className="py-3 pr-4 font-medium text-white">
                    {entry.status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
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

