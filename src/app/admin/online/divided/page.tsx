import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

import {
  getNextTradingPeriod,
  getPreviousTradingPeriod,
  getTradingPeriodFor,
  parseTradingPeriodKey,
} from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { canonicalNairobiWeekStartUtc, parseDateOnlyUtc } from "@/lib/weekWindow";

import DividedViewClient from "@/app/admin/online/summary/_components/DividedView.client";

export const dynamic = "force-dynamic";

type SearchParams = {
  periodKey?: string;
  weekStart?: string;
};

function getLast4FullWeeksForTradingPeriod(period: { start: Date; end: Date }, reference = new Date()) {
  return getOnlineOpsWeeksForTradingPeriod(period, reference, 4).map((wk) => ({
    weekStart: wk.weekStart,
    weekEndExclusive: wk.weekEndExclusive,
    weekEndInclusive: wk.weekEndInclusive,
    label: wk.label,
    key: wk.key,
    startInput: wk.startInput,
  }));
}

export default async function AdminOnlineDividedPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const resolved = await Promise.resolve(searchParams ?? {});
  const period = parseTradingPeriodKey(resolved.periodKey) ?? getTradingPeriodFor(new Date());
  const now = new Date();
  const previousPeriod = getPreviousTradingPeriod(period);
  const nextPeriod = getNextTradingPeriod(period);
  const currentPeriod = getTradingPeriodFor(new Date());
  const lastPeriod = getPreviousTradingPeriod(currentPeriod);

  const last4Weeks = getLast4FullWeeksForTradingPeriod(period, now);
  const last4WeekStartInputs = new Set(last4Weeks.map((w) => w.startInput));

  const selectedWeekStartRaw = resolved.weekStart?.trim() ?? "";
  const selectedWeekStartDate = selectedWeekStartRaw ? parseDateOnlyUtc(selectedWeekStartRaw) : null;
  const selectedWeekStart = selectedWeekStartDate ? canonicalNairobiWeekStartUtc(selectedWeekStartDate) : null;
  const selectedWeekKey = selectedWeekStart ? selectedWeekStart.toISOString().slice(0, 10) : "";

  // Keep behavior consistent with Summary page: only allow selection from the same 4-week window.
  const safeSelectedWeekKey = last4WeekStartInputs.has(selectedWeekKey) ? selectedWeekKey : "";
  const selectedWeek = safeSelectedWeekKey ? last4Weeks.find((w) => w.startInput === safeSelectedWeekKey) ?? null : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Divided view</h1>
        <p className="text-sm text-slate-400">
          Trading period: {period.label}. Select a full Monday-Sunday week below. Use the period controls to move back
          and review older weeks.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/admin/online/divided?periodKey=${encodeURIComponent(currentPeriod.key)}`}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              period.key === currentPeriod.key
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-slate-200 hover:bg-white/5"
            }`}
          >
            Current period
          </Link>
          <Link
            href={`/admin/online/divided?periodKey=${encodeURIComponent(lastPeriod.key)}`}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              period.key === lastPeriod.key
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-slate-200 hover:bg-white/5"
            }`}
          >
            Previous period
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/online/divided?periodKey=${encodeURIComponent(previousPeriod.key)}`}
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            ← Previous period
          </Link>
          <Link
            href={`/admin/online/divided?periodKey=${encodeURIComponent(nextPeriod.key)}`}
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            Next period →
          </Link>
        </div>

        <div className="mt-1 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Weeks In This Period</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              {last4Weeks.map((wk) => (
                <Link
                  key={wk.key}
                  href={`/admin/online/divided?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}`}
                  className={`block rounded-xl border px-3 py-2 hover:bg-white/5 ${
                    wk.startInput === safeSelectedWeekKey
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="font-semibold text-white">{wk.label}</div>
                  <div className="text-xs text-slate-400">Week start: {wk.startInput}</div>
                </Link>
              ))}
            </div>

            {safeSelectedWeekKey ? (
              <div className="mt-4">
                <Link
                  href={`/admin/online/divided?periodKey=${encodeURIComponent(period.key)}`}
                  className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
                >
                  Clear week selection →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 lg:col-span-2">
            {safeSelectedWeekKey ? (
              <>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Selected week</p>
                    <p className="mt-1 text-sm font-semibold text-white">{selectedWeek?.label ?? safeSelectedWeekKey}</p>
                  </div>
                  <div className="text-xs text-slate-400">
                    Week end inclusive:{" "}
                    {selectedWeek?.weekEndInclusive
                      ? new Date(selectedWeek.weekEndInclusive).toISOString().slice(0, 10)
                      : "—"}
                  </div>
                </div>
                <div className="mt-4">
                  <DividedViewClient weekStart={safeSelectedWeekKey} periodKey={period.key} />
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-200">
                Select a week from the left panel to view divided calculations.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h2 className="text-sm font-semibold text-white">Navigation</h2>
        <p className="mt-1 text-sm text-slate-400">
          Manual weekly entries are managed under{" "}
          <Link className="font-semibold text-emerald-200 hover:text-emerald-100" href="/admin/online/manual">
            Manual weekly sales
          </Link>
          . Summary totals remain on{" "}
          <Link className="font-semibold text-emerald-200 hover:text-emerald-100" href="/admin/online/summary">
            Summary
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
