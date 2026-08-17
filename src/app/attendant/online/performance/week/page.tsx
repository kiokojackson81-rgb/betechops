import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import WeekProfitEntriesClient from "@/app/admin/online/performance/_components/WeekProfitEntries.client";
import { Prisma } from "@prisma/client";
import { canAccessOnlineSupervisorWorkspace } from "@/lib/onlineSupervisorAccess";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type SearchParams = { weekStart?: string; periodKey?: string; accountId?: string; impersonateId?: string };

export default async function AttendantPerformanceWeekPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolved = await Promise.resolve(searchParams ?? {});
  if (!(await canAccessOnlineSupervisorWorkspace(resolved.impersonateId))) {
    return redirect("/not-authorized");
  }
  const session = await auth();
  const actorId = resolved.impersonateId || String((session?.user as { id?: string } | undefined)?.id ?? "");
  const impersonateQuery = resolved.impersonateId
    ? `&impersonateId=${encodeURIComponent(resolved.impersonateId)}`
    : "";
  const captureHref = resolved.impersonateId
    ? `/attendant/online/performance/capture?impersonateId=${encodeURIComponent(resolved.impersonateId)}`
    : "/attendant/online/performance/capture";
  const period = parseTradingPeriodKey(resolved.periodKey) ?? getTradingPeriodFor(new Date());
  const accountId = (resolved.accountId ?? "").trim();

  const weekStartRaw = (resolved.weekStart ?? "").trim();
  const parsed = weekStartRaw ? parseDateOnlyUtc(weekStartRaw) : null;
  if (!parsed) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-white">Week performance</h1>
        <p className="text-sm text-slate-400">Missing `weekStart` query parameter.</p>
        <Link
          href={resolved.impersonateId ? `/attendant/online/performance?impersonateId=${encodeURIComponent(resolved.impersonateId)}` : "/attendant/online/performance"}
          className="text-emerald-200 hover:text-emerald-100"
        >
          Back to performance
        </Link>
      </div>
    );
  }

  const canonicalStart = canonicalNairobiWeekStartUtc(parsed);
  const window = mondayToSundayNairobiWindow(canonicalStart);
  const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);

  let entries: any[] = [];
  let lossCount = 0;
  let dbReady = true;
  let isLossColumnReady = true;
  let accountIdColumnReady = true;
  try {
    const [e, lc] = await Promise.all([
      (prisma as any).marketplaceProfitEntry.findMany({
        where: {
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          periodKey: period.key,
          enteredByAdminId: actorId,
          ...(accountId ? { accountId } : {}),
        },
        select: {
          id: true,
          date: true,
          platform: true,
          itemCreditTxn: true,
          itemCreditAmount: true,
          commissionAmount: true,
          shippingAmount: true,
          netPayout: true,
          buyingPrice: true,
          profit: true,
          isLoss: true,
          enteredByAdmin: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ profit: "asc" }, { date: "asc" }],
      }),
      (prisma as any).marketplaceProfitEntry.count({
        where: {
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          periodKey: period.key,
          enteredByAdminId: actorId,
          isLoss: true,
          ...(accountId ? { accountId } : {}),
        },
      }),
    ]);
    entries = e;
    lossCount = Number(lc ?? 0);
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      dbReady = false;
      entries = [];
      lossCount = 0;
    } else if (err?.code === "P2022") {
      isLossColumnReady = false;
      if (accountId) accountIdColumnReady = false;
      const [e, lc] = await Promise.all([
        (prisma as any).marketplaceProfitEntry.findMany({
          where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key, enteredByAdminId: actorId },
          select: {
            id: true,
            date: true,
            platform: true,
            itemCreditTxn: true,
            itemCreditAmount: true,
            commissionAmount: true,
            shippingAmount: true,
            netPayout: true,
            buyingPrice: true,
            profit: true,
            enteredByAdmin: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ profit: "asc" }, { date: "asc" }],
        }),
        (prisma as any).marketplaceProfitEntry.count({
          where: { weekStart: window.weekStart, weekEnd: window.weekEnd, periodKey: period.key, enteredByAdminId: actorId, profit: { lt: 0 } },
        }),
      ]);
      entries = e;
      lossCount = Number(lc ?? 0);
    } else {
      throw err;
    }
  }

  const rows = (entries as any[]).map((e) => ({
    id: String(e.id),
    date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
    platform: e.platform,
    itemCreditTxn: String(e.itemCreditTxn ?? ""),
    itemCreditAmount: Number(e.itemCreditAmount ?? 0),
    commissionAmount: Number(e.commissionAmount ?? 0),
    shippingAmount: Number(e.shippingAmount ?? 0),
    netPayout: Number(e.netPayout ?? 0),
    buyingPrice: Number(e.buyingPrice ?? 0),
    profit: Number(e.profit ?? 0),
    enteredBy: e.enteredByAdmin?.name || e.enteredByAdmin?.email || "-",
    isLoss: Boolean(e.isLoss),
  }));
  const lossEntries = rows.filter((e) => Number(e.profit ?? 0) < 0);
  const lossEntriesFlagged = rows.filter((e) => Boolean((e as any).isLoss));

  return (
    <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
          <h1 className="text-3xl font-semibold text-white">Week performance</h1>
          <p className="text-sm text-slate-300">
            {formatNairobiDate(window.weekStart)} – {formatNairobiDate(endInclusive)} (Trading period: {period.label})
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/attendant/online/performance?periodKey=${encodeURIComponent(period.key)}${impersonateQuery}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Back to performance
            </Link>
            <Link
              href={captureHref}
              className="rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
            >
              Capture profit
            </Link>
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">
              Loss entries: <span className="font-semibold text-amber-200">{lossCount}</span>
            </div>
          </div>
        </header>

      {!dbReady && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Performance is not available yet (database migration pending).
        </div>
      )}
      {dbReady && !isLossColumnReady && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Database is missing the <code className="font-mono">isLoss</code> column. Loss is detected using profit &lt; 0.
        </div>
      )}
      {dbReady && !accountIdColumnReady && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Database is missing the <code className="font-mono">accountId</code> column. Shop filtering may be limited.
        </div>
      )}

        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Loss entries</h2>
          <p className="text-sm text-slate-400">Profit &lt; 0.</p>
          <div className="mt-4">
            <WeekProfitEntriesClient
              rows={(lossEntriesFlagged.length ? lossEntriesFlagged : lossEntries) as any}
              emptyText="No loss entries for this week."
              variant="loss"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">All entries</h2>
          <div className="mt-4">
            <WeekProfitEntriesClient rows={rows as any} emptyText="No profit entries captured for this week." variant="all" enableBulkDelete />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Note</h2>
          <p className="text-sm text-slate-400">
            Totals are hidden in supervisor view. Admin dashboards still include your entries for analysis.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Quick check</h2>
          <p className="text-sm text-slate-400">
            Net payout = item credit + commission + shipping. Profit = net payout - buying price.
          </p>
        </section>
    </div>
  );
}
