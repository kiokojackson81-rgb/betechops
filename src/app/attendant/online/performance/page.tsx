import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AttendantPerformancePage() {
  const session = await auth();
  const email = String((session?.user as any)?.email ?? "").toLowerCase();
  const actorId = String((session?.user as any)?.id ?? "");
  if (email !== "benjamin@betech.co.ke") {
    return redirect("/not-authorized");
  }

  const period = getTradingPeriodFor(new Date());
  const now = new Date();
  const weeks = getOnlineOpsWeeksForTradingPeriod(period, now, 4);
  const weekStarts = weeks.map((w) => w.weekStart);

  let dbReady = true;
  let lossCounts: Array<{ weekStart: string; count: number }> = [];
  try {
    const grouped = await (prisma as any).marketplaceProfitEntry.groupBy({
      by: ["weekStart"],
      _count: { _all: true },
      where: { weekStart: { in: weekStarts }, periodKey: period.key, isLoss: true, enteredByAdminId: actorId },
      orderBy: { weekStart: "asc" },
    });
    lossCounts = (grouped as any[]).map((row) => ({
      weekStart: new Date(row.weekStart).toISOString(),
      count: Number(row._count?._all ?? 0),
    }));
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      dbReady = false;
    }
  }

  const lossMap = new Map(lossCounts.map((r) => [r.weekStart, r.count]));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Performance</h1>
        <p className="text-sm text-slate-400">Review your captured entries per order (no totals).</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/attendant/online"
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            Back to dashboard
          </Link>
          <Link
            href="/attendant/online/performance/capture"
            className="rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
          >
            Capture profit
          </Link>
        </div>
      </header>

      {!dbReady ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Performance is not available yet (database migration pending).
        </div>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Weeks (current period)</h2>
          <p className="text-sm text-slate-400">{period.label}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {weeks.map((wk) => {
              const lossCount = lossMap.get(wk.weekStart.toISOString()) ?? 0;
              return (
                <Link
                  key={wk.key}
                  href={`/attendant/online/performance/week?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}`}
                  className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-4 hover:bg-white/5"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">Week</p>
                  <p className="mt-1 text-sm font-semibold text-white">{wk.label}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Loss entries</span>
                    <span className="font-semibold text-amber-200">{lossCount}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

