// src/app/admin/pending-pricing/page.tsx
import WeeklySummary from "./WeeklySummary";
import UnpricedOrdersClient from "./UnpricedOrdersClient";
import { getRecentJumiaWeeks, type TradingPeriod } from "@/lib/tradingPeriod";

type PendingPricingPageProps = {
  searchParams?: { week?: string };
};

export default async function PendingPricingPage({ searchParams }: PendingPricingPageProps) {
  const weeks = getRecentJumiaWeeks(2);
  const defaultWeek = weeks[0];
  const selectedWeek =
    weeks.find((week) => week.key === (searchParams?.week ?? "")) ?? defaultWeek;

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pending pricing</h1>
          <p className="text-sm text-slate-400">
            Review Jumia orders that still need a buying price. Toggle the trading period to view last week or the current week.
          </p>
        </div>
        <form action="/admin/pending-pricing" method="get" className="flex items-center gap-3">
          <label htmlFor="week" className="text-xs uppercase tracking-wide text-slate-400">
            Trading period
          </label>
          <select
            id="week"
            name="week"
            defaultValue={selectedWeek.key}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200"
          >
            {weeks.map((week) => (
              <option key={week.key} value={week.key}>
                {week.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20"
          >
            Apply
          </button>
        </form>
      </div>
      <div className="space-y-6">
        <WeeklySummary period={selectedWeek} />
        <UnpricedOrdersClient period={selectedWeek} />
      </div>
    </div>
  );
}
