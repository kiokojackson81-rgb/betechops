"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReportsPage;
const categories_1 = require("@/lib/attendants/categories");
const reporting_1 = require("@/lib/attendants/reporting");
function formatDateRange(start, days) {
    const end = new Date();
    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${startStr} - ${endStr} (${days} days)`;
}
function formatCurrency(value) {
    return `KES ${new Intl.NumberFormat().format(Math.round(value))}`;
}
async function ReportsPage() {
    const summary = await (0, reporting_1.getAttendantCategorySummary)(7);
    return (<div className="mx-auto max-w-6xl space-y-8 p-8 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Attendant Category Reports</h1>
        <p className="text-slate-300">
          Monitor how each attendant category is performing. These summaries combine direct activity logs (daily sales, product uploads) with live order
          queues.
        </p>
        <div className="inline-flex rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-400">
          {formatDateRange(summary.since, summary.days)}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {categories_1.attendantCategories.map((cat) => {
            const data = summary.categories[cat.id];
            const dailySales = data?.metrics?.DAILY_SALES?.numericSum ?? 0;
            const uploads = data?.metrics?.PRODUCT_UPLOADS?.intSum ?? 0;
            const cardsBase = "rounded-2xl border border-white/10 bg-white/5 p-5 shadow";
            return (<section key={cat.id} className={cardsBase}>
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
                {dailySales > 0 && (<div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <span>Logged daily sales</span>
                    <strong className="text-emerald-200">{formatCurrency(dailySales)}</strong>
                  </div>)}
                {uploads > 0 && (<div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                    <span>Products uploaded</span>
                    <strong className="text-cyan-200">{uploads}</strong>
                  </div>)}

                {data?.orderCounts ? (<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-xs uppercase tracking-widest text-slate-400">Order pipeline</div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(data.orderCounts).map(([status, count]) => (<div key={status} className="flex flex-col rounded bg-white/5 px-2 py-2">
                          <dt className="text-[10px] uppercase tracking-widest text-slate-400">{status}</dt>
                          <dd className="text-base font-semibold text-white">{count}</dd>
                        </div>))}
                    </dl>
                  </div>) : null}

                {!dailySales && !uploads && !data?.orderCounts && (<div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                    No tracked activity yet for this category.
                  </div>)}
              </div>
            </section>);
        })}
      </div>
    </div>);
}
