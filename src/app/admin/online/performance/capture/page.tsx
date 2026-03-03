import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfitCaptureFormClient from "@/app/admin/online/performance/_components/ProfitCaptureForm.client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default async function OnlinePerformanceCapturePage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const email = String((session?.user as any)?.email ?? "").toLowerCase();
  const isBenjamin = email === "benjamin@betech.co.ke";
  const limitedView = isBenjamin && role !== "ADMIN";
  if (role !== "ADMIN" && role !== "SUPERVISOR" && !isBenjamin) {
    return redirect("/not-authorized");
  }

  const period = getTradingPeriodFor(new Date());

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { isActive: true },
    select: { id: true, platform: true, displayName: true },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });

  let dbReady = true;
  let perAccountRows: Array<{
    accountId: string;
    netPayout: number;
    profit: number;
    count: number;
    account?: { id: string; platform: any; displayName: string } | undefined;
  }> = [];
  let totals = { netPayout: 0, profit: 0, count: 0 };

  if (!limitedView) {
    try {
      const rows = await (prisma as any).marketplaceProfitEntry.groupBy({
        by: ["accountId"],
        _sum: { netPayout: true, profit: true },
        _count: { _all: true },
        where: { periodKey: period.key },
        orderBy: { accountId: "asc" },
      });

      const perAccountAgg = (rows as any[]).map((row) => ({
        accountId: String(row.accountId),
        netPayout: Number(row._sum?.netPayout ?? 0),
        profit: Number(row._sum?.profit ?? 0),
        count: Number(row._count?._all ?? 0),
      }));

      totals = perAccountAgg.reduce(
        (acc, r) => {
          acc.netPayout += r.netPayout;
          acc.profit += r.profit;
          acc.count += r.count;
          return acc;
        },
        { netPayout: 0, profit: 0, count: 0 },
      );

      const accountMap = new Map(accounts.map((a) => [a.id, a]));
      perAccountRows = perAccountAgg
        .map((r) => ({
          ...r,
          account: accountMap.get(r.accountId),
        }))
        .filter((r) => Boolean(r.account))
        .sort((a, b) => (b.profit || 0) - (a.profit || 0));
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
        dbReady = false;
      } else {
        throw err;
      }
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Profit capture</h1>
        <p className="text-sm text-slate-400">
          Paste the marketplace transaction block and enter buying price. The system extracts credit/fees, computes net
          payout, profit and margin, and stores the raw text for audit.
        </p>
      </header>

      {limitedView ? (
        <ProfitCaptureFormClient accounts={accounts} limitedView />
      ) : (
        <ProfitCaptureFormClient accounts={accounts} />
      )}

      {!limitedView && dbReady && perAccountRows.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Per shop (current period)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Shop</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Sales</th>
                  <th className="px-3 py-2">Profit</th>
                  <th className="px-3 py-2">Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {perAccountRows.map((r) => (
                  <tr key={r.accountId} className="hover:bg-white/5">
                    <td className="px-3 py-2 text-slate-100">{r.account?.displayName}</td>
                    <td className="px-3 py-2 text-slate-300">{r.account?.platform}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-300">{currency.format(r.netPayout)}</td>
                    <td className={`px-3 py-2 font-semibold ${r.profit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                      {currency.format(r.profit)}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
