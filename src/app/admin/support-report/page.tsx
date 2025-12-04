import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecentTradingPeriods, getTradingPeriodFor } from "@/lib/tradingPeriod";

type SearchParams = Record<string, string | string[] | undefined> | undefined;

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const dynamic = "force-dynamic";

function getParam(value?: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminSupportReportPage(props: { searchParams?: SearchParams }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return redirect("/not-authorized");
  }

  const searchParams = props?.searchParams;
  const periods = getRecentTradingPeriods(12);
  const selectedPeriod =
    (searchParams?.period &&
      periods.find((period) => period.key === getParam(searchParams.period))) ||
    getTradingPeriodFor(new Date());

  const dow = getParam(searchParams?.dow);
  const userFilter = getParam(searchParams?.user).trim();

  const where: any = {
    date: {
      gte: selectedPeriod.start,
      lte: selectedPeriod.end,
    },
  };
  if (dow) where.dayOfWeek = dow;
  if (userFilter) {
    where.submittedBy = {
      OR: [
        { name: { contains: userFilter, mode: "insensitive" } },
        { email: { contains: userFilter, mode: "insensitive" } },
      ],
    };
  }

  const entries = await prisma.supportDailyEntry.findMany({
    where,
    include: {
      submittedBy: { select: { name: true, email: true } },
      _count: { select: { receipts: true } },
    },
    orderBy: { date: "desc" },
  });

  const aggregates = entries.reduce(
    (acc, entry) => {
      acc.totalSales += entry.totalSales;
      acc.totalProfit += entry.totalProfit;
      acc.totalReceipts += entry._count.receipts;
      acc.newBatteries += entry.newBatteries;
      acc.changedBatteries += entry.changedBatteries;
      return acc;
    },
    {
      totalSales: 0,
      totalProfit: 0,
      totalReceipts: 0,
      newBatteries: 0,
      changedBatteries: 0,
    }
  );

  const batteryEarnings = (aggregates.newBatteries + aggregates.changedBatteries) * 70;

  const currency = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  });
  const dateFormatter = new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-emerald-300">Admin</p>
            <h1 className="text-3xl font-semibold">Support Operations Report</h1>
            <p className="text-sm text-slate-400">
              Review support attendants’ daily submissions, sales totals, and battery performance.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
            Current trading period: <span className="font-semibold text-white">{selectedPeriod.label}</span>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
          <form className="grid gap-4 md:grid-cols-3" method="get">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-wide text-slate-400">Trading period</span>
              <select
                name="period"
                defaultValue={selectedPeriod.key}
                className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
              >
                {periods.map((period) => (
                  <option key={period.key} value={period.key}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-wide text-slate-400">Day of week</span>
              <select
                name="dow"
                defaultValue={dow}
                className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
              >
                <option value="">All days</option>
                {DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-wide text-slate-400">Attendant (name or email)</span>
              <input
                type="text"
                name="user"
                defaultValue={userFilter}
                placeholder="e.g. support@betech.co.ke"
                className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </label>
            <div className="md:col-span-3 flex justify-end gap-3">
              <a
                href="/admin/support-report"
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
              >
                Reset
              </a>
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95"
              >
                Apply filters
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Total sales" value={currency.format(aggregates.totalSales)} />
          <SummaryCard label="Battery earnings" value={currency.format(batteryEarnings)} />
          <SummaryCard label="Receipts" value={aggregates.totalReceipts.toLocaleString()} />
          <SummaryCard
            label="Batteries (new / changed)"
            value={`${aggregates.newBatteries.toLocaleString()} / ${aggregates.changedBatteries.toLocaleString()}`}
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/5 bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Attendant</th>
                  <th className="px-4 py-3 text-right">Sales (KES)</th>
                  <th className="px-4 py-3 text-right">Profit (KES)</th>
                  <th className="px-4 py-3 text-center">Receipts</th>
                  <th className="px-4 py-3 text-center">New batteries</th>
                  <th className="px-4 py-3 text-center">Changed batteries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                      No support submissions match your filters.
                    </td>
                  </tr>
                )}
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-slate-200">{dateFormatter.format(entry.date)}</td>
                    <td className="px-4 py-3 text-slate-300">{entry.dayOfWeek}</td>
                    <td className="px-4 py-3 text-slate-200">
                      <div className="flex flex-col">
                        <span>{entry.submittedBy?.name ?? "Unknown"}</span>
                        <span className="text-xs text-slate-500">{entry.submittedBy?.email ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-300">
                      {currency.format(entry.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {currency.format(entry.totalProfit)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-200">{entry._count.receipts}</td>
                    <td className="px-4 py-3 text-center text-slate-200">{entry.newBatteries}</td>
                    <td className="px-4 py-3 text-center text-slate-200">{entry.changedBatteries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-slate-900/60 px-4 py-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-emerald-300">{value}</p>
    </div>
  );
}
