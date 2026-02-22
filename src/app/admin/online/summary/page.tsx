import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NAIROBI_WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Nairobi", weekday: "short" });
const isNairobiSunday = (date: Date) => NAIROBI_WEEKDAY.format(date).toLowerCase().startsWith("sun");

function getLast4FullWeeksForTradingPeriod(period: { start: Date; end: Date }, reference = new Date()) {
  const anchor = new Date(Math.min(period.end.getTime(), reference.getTime()));
  let lastWeekStart = canonicalNairobiWeekStartUtc(anchor);
  if (!isNairobiSunday(anchor)) {
    lastWeekStart = new Date(lastWeekStart.getTime() - 7 * MS_PER_DAY);
  }
  return [3, 2, 1, 0].map((offset) => {
    const start = new Date(lastWeekStart.getTime() - offset * 7 * MS_PER_DAY);
    const window = mondayToSundayNairobiWindow(start);
    const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);
    return {
      weekStart: window.weekStart,
      weekEndExclusive: window.weekEnd,
      weekEndInclusive: endInclusive,
      label: `${formatNairobiDate(window.weekStart)} – ${formatNairobiDate(endInclusive)}`,
      key: window.weekStart.toISOString(),
      startInput: window.weekStart.toISOString().slice(0, 10),
    };
  });
}

export default async function AdminOnlineSummaryPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const period = getTradingPeriodFor(new Date());
  const now = new Date();
  const last4Weeks = getLast4FullWeeksForTradingPeriod(period, now);
  const last4WeekStarts = last4Weeks.map((w) => w.weekStart);
  const last4WeekStartInputs = new Set(last4Weeks.map((w) => w.startInput));

  const manualWeeklyRows = await prisma.weeklySale.findMany({
    where: {
      source: "MANUAL",
      status: { not: "REJECTED" },
      weekStart: { in: last4WeekStarts },
    },
    include: {
      shop: { select: { id: true, name: true, platform: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ platform: "asc" }, { shopId: "asc" }, { userId: "asc" }, { weekStart: "desc" }],
  });

  const manualAggMap = new Map<
    string,
    {
      platform: Platform;
      shopId: string | null;
      shopName: string;
      attendantId: string | null;
      attendantName: string;
      total: number;
      weekKeys: Set<string>;
    }
  >();

  const attendantTotals = new Map<string, { attendantId: string | null; attendantName: string; total: number }>();

  for (const row of manualWeeklyRows as any[]) {
    const platform = row.platform as Platform;
    const shopId = (row.shopId ?? null) as string | null;
    const userId = (row.userId ?? null) as string | null;
    const weekStartKey = canonicalNairobiWeekStartUtc(new Date(row.weekStart)).toISOString().slice(0, 10);
    if (!last4WeekStartInputs.has(weekStartKey)) continue;

    const shopName = (row.shop?.name ?? shopId ?? "Unassigned").toString();
    const attendantName = (row.user?.name ?? row.user?.email ?? userId ?? "—").toString();
    const amount = Number(row.amount ?? 0);

    const key = `${platform}|${shopId ?? "none"}|${userId ?? "none"}`;
    if (!manualAggMap.has(key)) {
      manualAggMap.set(key, {
        platform,
        shopId,
        shopName,
        attendantId: userId,
        attendantName,
        total: 0,
        weekKeys: new Set<string>(),
      });
    }
    const agg = manualAggMap.get(key)!;
    agg.total += amount;
    agg.weekKeys.add(weekStartKey);

    const attKey = userId ?? "none";
    if (!attendantTotals.has(attKey)) {
      attendantTotals.set(attKey, { attendantId: userId, attendantName, total: 0 });
    }
    attendantTotals.get(attKey)!.total += amount;
  }

  const manualAggRows = Array.from(manualAggMap.values()).sort((a, b) => {
    if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
    if (a.shopName !== b.shopName) return a.shopName.localeCompare(b.shopName);
    return a.attendantName.localeCompare(b.attendantName);
  });

  const attendantTotalRows = Array.from(attendantTotals.values()).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Manual weekly sales</h1>
        <p className="text-sm text-slate-400">
          Current trading period: {period.label}. Snapshot below uses the last 4 full Monday–Sunday weeks within this
          period.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Summary (last 4 weeks)</h2>
            <p className="text-sm text-slate-400">Per shop and attendant totals for Jumia & Kilimall.</p>
          </div>
          <Link
            href="/admin/online/manual"
            className="inline-flex items-center justify-center rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
          >
            Open manual sales desk
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Weeks (last 4)</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              {last4Weeks.map((wk) => (
                <div key={wk.key} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="font-semibold text-white">{wk.label}</div>
                  <div className="text-xs text-slate-400">Week start: {wk.startInput}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 lg:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Per shop & attendant (manual)</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Platform</th>
                    <th className="py-2 pr-4">Shop</th>
                    <th className="py-2 pr-4">Attendant</th>
                    <th className="py-2 pr-4 text-right">Weeks</th>
                    <th className="py-2 pr-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {manualAggRows.map((row) => (
                    <tr
                      key={`${row.platform}-${row.shopId ?? "none"}-${row.attendantId ?? "none"}`}
                      className="border-t border-white/5"
                    >
                      <td className="py-3 pr-4 text-slate-200">{row.platform}</td>
                      <td className="py-3 pr-4 font-medium text-white">{row.shopName}</td>
                      <td className="py-3 pr-4 text-slate-200">{row.attendantName}</td>
                      <td className="py-3 pr-4 text-right text-slate-200">{row.weekKeys.size}/4</td>
                      <td className="py-3 pr-4 text-right font-semibold text-emerald-300">
                        {currencyFormatter.format(row.total)}
                      </td>
                    </tr>
                  ))}
                  {!manualAggRows.length && (
                    <tr>
                      <td className="py-3 pr-4 text-slate-400" colSpan={5}>
                        No manual weekly sales captured for the last 4 full weeks.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Per attendant totals (manual)</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-4">Attendant</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendantTotalRows.map((row) => (
                      <tr key={row.attendantId ?? "none"} className="border-t border-white/5">
                        <td className="py-3 pr-4 text-slate-200">{row.attendantName}</td>
                        <td className="py-3 pr-4 text-right font-semibold text-emerald-300">
                          {currencyFormatter.format(row.total)}
                        </td>
                      </tr>
                    ))}
                    {!attendantTotalRows.length && (
                      <tr>
                        <td className="py-3 pr-4 text-slate-400" colSpan={2}>
                          No manual weekly sales captured yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

