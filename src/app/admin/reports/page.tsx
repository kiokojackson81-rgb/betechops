import { attendantCategoryDefinitions } from "@/lib/attendants/definitions";
import { getAttendantCategorySummary } from "@/lib/attendants/reporting";

function formatDateRange(start: Date, days: number) {
  const end = new Date(start);
  end.setDate(start.getDate() + days - 1);
  const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startStr} - ${endStr} (${days} days)`;
}

function formatCurrency(value: number) {
  return `KES ${new Intl.NumberFormat().format(Math.round(value))}`;
}

export default async function ReportsPage({ searchParams }: { searchParams?: { trading?: string; days?: string; ref?: string } }) {
  const isTrading = Boolean(searchParams?.trading);
  const days = searchParams?.days ? parseInt(searchParams.days, 10) || 7 : 7;
  const refDate = searchParams?.ref;

  const summary = isTrading
    ? await getAttendantCategorySummary({ tradingPeriod: true, refDate })
    : await getAttendantCategorySummary(days);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Attendant Category Reports</h1>
        <p className="text-slate-300">
          Monitor how each attendant category is performing. These summaries combine direct activity logs (daily sales, product uploads) with live order
          queues.
        </p>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-400">
            {formatDateRange(summary.since, summary.days)}
          </div>
          <nav className="inline-flex items-center gap-2 text-xs">
            <a
              className={`rounded-md px-2 py-1 ${!isTrading ? "bg-white/5" : "bg-transparent"}`}
              href={`?days=${days}`}
            >
              Last {days} days
            </a>
            <a
              className={`rounded-md px-2 py-1 ${isTrading ? "bg-white/5" : "bg-transparent"}`}
              href={`?trading=1${refDate ? `&ref=${encodeURIComponent(refDate)}` : ""}`}
            >
              Trading period (25th–24th)
            </a>
          </nav>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {attendantCategoryDefinitions.map((cat) => {
          const data = (summary.categories as any)[cat.id];
          const dailySales = data?.metrics?.DAILY_SALES?.numericSum ?? 0;
          const uploads = data?.metrics?.PRODUCT_UPLOADS?.intSum ?? 0;
          const cardsBase = "rounded-2xl border border-white/10 bg-white/5 p-5 shadow";
          return (
            <section key={cat.id} className={cardsBase}>
              <header className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{cat.label}</h2>
                  <p className="text-xs text-slate-400">{cat.description}</p>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                  {data?.users ?? 0} attendant{(data?.users ?? 0) === 1 ? "" : "s"}
                </div>
              </header>

              <div className="space-y-3 text-sm text-slate-200">
                {dailySales > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <span>Logged daily sales</span>
                    <strong className="text-emerald-200">{formatCurrency(dailySales)}</strong>
                  </div>
                )}
                {uploads > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                    <span>Products uploaded</span>
                    <strong className="text-cyan-200">{uploads}</strong>
                  </div>
                )}

                {data?.orderCounts ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-xs uppercase tracking-widest text-slate-400">Order pipeline</div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(data.orderCounts).map(([status, count]) => (
                        <div key={status} className="flex flex-col rounded bg-white/5 px-2 py-2">
                          <dt className="text-[10px] uppercase tracking-widest text-slate-400">{status}</dt>
                          <dd className="text-base font-semibold text-white">{String(count)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                {/* extra numeric metrics introduced by daily report */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["newProducts", "New products"],
                    ["productsEdited", "Products edited"],
                    ["copiesUploaded", "Copies uploaded"],
                    ["walkInServed", "Walk-ins served"],
                    ["purchasesMade", "Purchases"],
                    ["liveSessionsCount", "Live sessions"],
                    ["commissionEarned", "Commission earned"],
                    ["confirmedCompetitiveness", "Confirmed competitiveness"],
                    ["promoVideos", "Promo videos"],
                    ["demoVideos", "Demo videos"],
                    ["engagementReplies", "Engagement replies"],
                    ["allCommentsReplied", "All comments replied"],
                  ].map(([metricKey, label]) => {
                    const snake = String(metricKey).replace(/([A-Z])/g, "_$1").toUpperCase();
                    const raw = data?.metrics?.[metricKey] ?? data?.metrics?.[snake];
                    const val = raw ? (raw.numericSum ?? raw.intSum ?? 0) : 0;
                    if (!val) return null;
                    return (
                      <div key={String(metricKey)} className="flex items-center justify-between rounded bg-white/5 px-2 py-2">
                        <dt className="text-[10px] uppercase tracking-widest text-slate-400">{label}</dt>
                        <dd className="text-sm font-semibold text-white">{String(Math.round(val))}</dd>
                      </div>
                    );
                  })}
                </div>

                {!dailySales && !uploads && !data?.orderCounts && Object.keys(data?.metrics ?? {}).length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                    No tracked activity yet for this category.
                  </div>
                )}
                {data?.concerns && data.concerns.count > 0 && (
                  <div className="mt-2 rounded-lg border border-yellow-600/20 bg-yellow-900/5 px-3 py-2">
                    <div className="text-xs uppercase tracking-widest text-yellow-300">Concerns</div>
                    <div className="mt-2 text-sm text-slate-200">
                      <div className="text-xs text-slate-400">{data.concerns.count} total</div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {data.concerns.recent.slice(0, 3).map((c: string, i: number) => (
                          <li key={i} className="rounded bg-white/3 px-2 py-1 text-slate-200">{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}


