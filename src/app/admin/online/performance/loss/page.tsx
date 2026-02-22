import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

type SearchParams = { periodKey?: string };

export default async function OnlinePerformanceLossPage({
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
  const now = new Date();

  const weeks = getOnlineOpsWeeksForTradingPeriod(period, now, 4);
  const weekStarts = weeks.map((w) => w.weekStart);

  const lossEntries = await (prisma as any).marketplaceProfitEntry.findMany({
    where: {
      periodKey: period.key,
      weekStart: { in: weekStarts },
      profit: { lt: new Prisma.Decimal(0) },
    },
    include: { enteredByAdmin: { select: { id: true, name: true, email: true } } },
    orderBy: [{ profit: "asc" }, { date: "asc" }],
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Loss monitor</h1>
        <p className="text-sm text-slate-400">
          Trading period: {period.label}. Showing loss entries within the 4 weeks for this period.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/admin/online/performance?periodKey=${encodeURIComponent(period.key)}`}
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

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-wrap gap-2">
          {weeks.map((wk) => (
            <Link
              key={wk.key}
              href={`/admin/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              {wk.startInput}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Loss entries</h2>
        <p className="text-sm text-slate-400">Sorted by worst profit first.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Week start</th>
                <th className="py-2 pr-4">Platform</th>
                <th className="py-2 pr-4">Txn</th>
                <th className="py-2 pr-4 text-right">Net payout</th>
                <th className="py-2 pr-4 text-right">Buying</th>
                <th className="py-2 pr-4 text-right">Profit</th>
                <th className="py-2 pr-4 text-right">Commission %</th>
                <th className="py-2 pr-4">Entered by</th>
              </tr>
            </thead>
            <tbody>
              {lossEntries.map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-slate-200">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-slate-200">{new Date(e.weekStart).toISOString().slice(0, 10)}</td>
                  <td className="py-3 pr-4 text-slate-200">{e.platform}</td>
                  <td className="py-3 pr-4 font-medium text-white">{e.itemCreditTxn}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.netPayout ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.buyingPrice ?? 0))}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-red-300">{currency.format(Number(e.profit ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{Number(e.commissionRatePct ?? 0).toFixed(1)}%</td>
                  <td className="py-3 pr-4 text-slate-300">{e.enteredByAdmin?.name || e.enteredByAdmin?.email || "-"}</td>
                </tr>
              ))}
              {!lossEntries.length && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={9}>
                    No loss entries for this period’s 4 weeks.
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
