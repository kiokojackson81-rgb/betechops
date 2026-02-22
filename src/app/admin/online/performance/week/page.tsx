import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";

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
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
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
          Back to performance →
        </Link>
      </div>
    );
  }

  const canonicalStart = canonicalNairobiWeekStartUtc(parsed);
  const window = mondayToSundayNairobiWindow(canonicalStart);
  const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);

  const [entries, agg, lossCount, manualWeeklyAgg] = await Promise.all([
    (prisma as any).marketplaceProfitEntry.findMany({
      where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key, ...(accountId ? { accountId } : {}) },
      include: { enteredByAdmin: { select: { id: true, name: true, email: true } } },
      orderBy: [{ profit: "asc" }, { date: "asc" }],
    }),
    (prisma as any).marketplaceProfitEntry.aggregate({
      _sum: { itemCreditAmount: true, netPayout: true, buyingPrice: true, profit: true },
      _avg: { commissionRatePct: true, marginPct: true },
      where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key, ...(accountId ? { accountId } : {}) },
    }),
    (prisma as any).marketplaceProfitEntry.count({
      where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key, profit: { lt: 0 }, ...(accountId ? { accountId } : {}) },
    }),
    prisma.weeklySale.aggregate({
      _sum: { amount: true },
      where: {
        weekStart: window.weekStart,
        weekEnd: window.weekEnd,
        source: WeeklySaleSource.MANUAL,
        status: { not: WeeklySaleStatus.REJECTED },
      },
    }),
  ]);

  const typedAgg = agg as any;
  const totalRevenue = Number(typedAgg?._sum?.itemCreditAmount ?? 0);
  const totalNet = Number(typedAgg?._sum?.netPayout ?? 0);
  const totalBuying = Number(typedAgg?._sum?.buyingPrice ?? 0);
  const totalProfit = Number(typedAgg?._sum?.profit ?? 0);
  const avgCommission = Number(typedAgg?._avg?.commissionRatePct ?? 0);
  const avgMargin = Number(typedAgg?._avg?.marginPct ?? 0);
  const manualWeeklyTotal = Number(manualWeeklyAgg._sum.amount ?? 0);

  const lossEntries = (entries as any[]).filter((e) => Number(e.profit ?? 0) < 0);

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

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">KPIs</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Revenue (item credit)</p>
            <p className="mt-2 text-xl font-semibold text-white">{currency.format(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Net payout</p>
            <p className="mt-2 text-xl font-semibold text-emerald-300">{currency.format(totalNet)}</p>
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
            <p className="text-xs uppercase tracking-wide text-slate-400">Manual weekly sales (if entered)</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{currency.format(manualWeeklyTotal)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Loss entries</h2>
        <p className="text-sm text-slate-400">Profit &lt; 0.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Platform</th>
                <th className="py-2 pr-4">Txn</th>
                <th className="py-2 pr-4 text-right">Net payout</th>
                <th className="py-2 pr-4 text-right">Buying</th>
                <th className="py-2 pr-4 text-right">Profit</th>
                <th className="py-2 pr-4">Entered by</th>
              </tr>
            </thead>
            <tbody>
              {lossEntries.map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-slate-200">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-slate-200">{e.platform}</td>
                  <td className="py-3 pr-4 font-medium text-white">{e.itemCreditTxn}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.netPayout ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.buyingPrice ?? 0))}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-red-300">{currency.format(Number(e.profit ?? 0))}</td>
                  <td className="py-3 pr-4 text-slate-300">
                    {e.enteredByAdmin?.name || e.enteredByAdmin?.email || "-"}
                  </td>
                </tr>
              ))}
              {!lossEntries.length && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={7}>
                    No loss entries for this week.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">All entries</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Platform</th>
                <th className="py-2 pr-4">Item credit txn</th>
                <th className="py-2 pr-4 text-right">Credit</th>
                <th className="py-2 pr-4 text-right">Commission</th>
                <th className="py-2 pr-4 text-right">Shipping</th>
                <th className="py-2 pr-4 text-right">Net payout</th>
                <th className="py-2 pr-4 text-right">Buying</th>
                <th className="py-2 pr-4 text-right">Profit</th>
                <th className="py-2 pr-4">Entered by</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-slate-200">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-slate-200">{e.platform}</td>
                  <td className="py-3 pr-4 font-medium text-white">{e.itemCreditTxn}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.itemCreditAmount ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.commissionAmount ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.shippingAmount ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.netPayout ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(e.buyingPrice ?? 0))}</td>
                  <td className={`py-3 pr-4 text-right font-semibold ${Number(e.profit ?? 0) < 0 ? "text-red-300" : "text-emerald-200"}`}>
                    {currency.format(Number(e.profit ?? 0))}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">
                    {e.enteredByAdmin?.name || e.enteredByAdmin?.email || "-"}
                  </td>
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={10}>
                    No profit entries captured for this week.
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
