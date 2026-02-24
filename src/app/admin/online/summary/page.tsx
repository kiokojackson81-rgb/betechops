import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import {
  getPreviousTradingPeriod,
  getTradingPeriodFor,
  parseTradingPeriodKey,
  type TradingPeriod,
} from "@/lib/tradingPeriod";
import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { canDownloadOnlineSummaryIndividual } from "@/lib/onlineSummaryIndividuals";
import { redirect } from "next/navigation";
import Link from "next/link";
import ManualWeekViewClient from "@/app/admin/online/summary/_components/ManualWeekView.client";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function getNextTradingPeriod(period: TradingPeriod): TradingPeriod {
  const nextDay = new Date(period.end.getTime() + MS_PER_DAY);
  return getTradingPeriodFor(nextDay);
}

type AttendantInfo = { id: string; name: string | null; email: string | null };
type ShopPayload = {
  id: string;
  shopName: string | null;
  displayName: string | null;
  platform: Platform;
  attendants: AttendantInfo[];
  primaryAttendant: AttendantInfo | null;
  identifiers: { jumiaShopSid: string | null; kilimallShopCode: string | null };
};

async function loadOnlineShopsForSummary(): Promise<ShopPayload[]> {
  const now = new Date();
  const [accounts, shops] = await Promise.all([
    prisma.marketplaceAccount.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        platform: true,
        displayName: true,
        jumiaShopSid: true,
        kilimallShopCode: true,
        assignments: {
          where: {
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
          orderBy: { startsAt: "desc" },
          select: {
            attendantId: true,
            attendant: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, name: true, platform: true, apiConfig: { select: { apiKey: true } } },
    }),
  ]);

  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const shopsByName = new Map(
    shops
      .filter((shop) => Boolean(shop.name))
      .map((shop) => [shop.name.trim().toLowerCase(), shop]),
  );
  const shopsByApiKey = new Map<string, (typeof shops)[number]>();
  for (const shop of shops) {
    const apiKey = (shop as any).apiConfig?.apiKey;
    if (apiKey) shopsByApiKey.set(String(apiKey), shop);
  }

  const matchedAccountIds = new Set<string>();
  const payload = accounts
    .map((account) => {
      const matchById = shopsById.get(account.id);
      const matchByName = account.displayName ? shopsByName.get(account.displayName.trim().toLowerCase()) : undefined;
      const matchByApiKey = account.jumiaShopSid ? shopsByApiKey.get(account.jumiaShopSid) : undefined;
      const matchByApiKey2 = !matchByApiKey && account.kilimallShopCode ? shopsByApiKey.get(account.kilimallShopCode) : undefined;
      const shopRecord = matchById ?? matchByName ?? matchByApiKey ?? matchByApiKey2;
      if (!shopRecord) return null;
      matchedAccountIds.add(account.id);

      const attendants = account.assignments
        .map((assignment) => assignment.attendant)
        .filter((attendant): attendant is NonNullable<typeof attendant> => Boolean(attendant))
        .map<AttendantInfo>((attendant) => ({ id: attendant.id, name: attendant.name ?? null, email: attendant.email ?? null }));

      return {
        id: shopRecord.id,
        shopName: shopRecord.name,
        displayName: account.displayName,
        platform: account.platform as Platform,
        attendants,
        primaryAttendant: attendants[0] ?? null,
        identifiers: { jumiaShopSid: account.jumiaShopSid, kilimallShopCode: account.kilimallShopCode },
      } as ShopPayload;
    })
    .filter((entry): entry is ShopPayload => Boolean(entry));

  const payloadById = new Map<string, ShopPayload>(payload.map((p) => [p.id, p]));
  for (const shop of shops) {
    if (!payloadById.has(shop.id)) {
      payloadById.set(shop.id, {
        id: shop.id,
        shopName: shop.name,
        displayName: shop.name ?? shop.id,
        platform: shop.platform as Platform,
        attendants: [],
        primaryAttendant: null,
        identifiers: { jumiaShopSid: null, kilimallShopCode: null },
      });
    }
  }

  const typedEmptyAttendant: AttendantInfo | null = null;
  for (const account of accounts) {
    if (matchedAccountIds.has(account.id)) continue;
    const attendants = account.assignments
      .map((assignment) => assignment.attendant)
      .filter((attendant): attendant is NonNullable<typeof attendant> => Boolean(attendant))
      .map((attendant) => ({ id: attendant.id, name: attendant.name ?? null, email: attendant.email ?? null }));
    payloadById.set(account.id, {
      id: account.id,
      shopName: account.displayName ?? account.id,
      displayName: account.displayName,
      platform: account.platform as Platform,
      attendants,
      primaryAttendant: attendants[0] ?? typedEmptyAttendant,
      identifiers: { jumiaShopSid: account.jumiaShopSid, kilimallShopCode: account.kilimallShopCode },
    } as ShopPayload);
  }

  return Array.from(payloadById.values())
    .filter((entry) => entry.identifiers.jumiaShopSid || entry.identifiers.kilimallShopCode)
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
}

export default async function AdminOnlineSummaryPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const resolvedParams = await Promise.resolve(searchParams ?? {});
  const period = parseTradingPeriodKey(resolvedParams.periodKey) ?? getTradingPeriodFor(new Date());
  const now = new Date();
  const last4Weeks = getLast4FullWeeksForTradingPeriod(period, now);
  const last4WeekStarts = last4Weeks.map((w) => w.weekStart);
  const last4WeekStartInputs = new Set(last4Weeks.map((w) => w.startInput));
  const selectedWeekStartRaw = resolvedParams.weekStart?.trim() ?? "";
  const selectedWeekStartDate = selectedWeekStartRaw ? parseDateOnlyUtc(selectedWeekStartRaw) : null;
  const selectedWeekStart = selectedWeekStartDate ? canonicalNairobiWeekStartUtc(selectedWeekStartDate) : null;
  const selectedWeekKey = selectedWeekStart ? selectedWeekStart.toISOString().slice(0, 10) : "";
  const selectedWeekWindow = selectedWeekStart ? mondayToSundayNairobiWindow(selectedWeekStart) : null;

  const previousPeriod = getPreviousTradingPeriod(period);
  const nextPeriod = getNextTradingPeriod(period);
  const currentPeriod = getTradingPeriodFor(new Date());
  const lastPeriod = getPreviousTradingPeriod(currentPeriod);

  const [manualWeeklyRows, onlineShops] = await Promise.all([
    prisma.weeklySale.findMany({
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
    }),
    loadOnlineShopsForSummary(),
  ]);

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

  const attendantTotals = new Map<
    string,
    { attendantId: string | null; attendantName: string; attendantEmail: string | null; total: number }
  >();

  for (const row of manualWeeklyRows as any[]) {
    const platform = row.platform as Platform;
    const shopId = (row.shopId ?? null) as string | null;
    const userId = (row.userId ?? null) as string | null;
    const weekStartKey = canonicalNairobiWeekStartUtc(new Date(row.weekStart)).toISOString().slice(0, 10);
    if (!last4WeekStartInputs.has(weekStartKey)) continue;

    const shopName = (row.shop?.name ?? shopId ?? "Unassigned").toString();
    const attendantName = (row.user?.name ?? row.user?.email ?? userId ?? "—").toString();
    const attendantEmail = row.user?.email ? String(row.user.email) : null;
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
      attendantTotals.set(attKey, { attendantId: userId, attendantName, attendantEmail, total: 0 });
    }
    attendantTotals.get(attKey)!.total += amount;
  }

  const manualAggRows = Array.from(manualAggMap.values()).sort((a, b) => {
    if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
    if (a.shopName !== b.shopName) return a.shopName.localeCompare(b.shopName);
    return a.attendantName.localeCompare(b.attendantName);
  });

  const attendantTotalRows = Array.from(attendantTotals.values()).sort((a, b) => b.total - a.total);

  const weekRowsForSelectedWeek = selectedWeekWindow
    ? await prisma.weeklySale.findMany({
        where: {
          source: "MANUAL",
          status: { not: "REJECTED" },
          weekStart: selectedWeekWindow.weekStart,
          weekEnd: selectedWeekWindow.weekEnd,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ platform: "asc" }, { shopId: "asc" }],
      })
    : [];

  const weekEntries = (weekRowsForSelectedWeek as any[]).map((row) => ({
    id: String(row.id),
    shopId: row.shopId ? String(row.shopId) : null,
    platform: row.platform as Platform,
    amount: Number(row.amount ?? 0),
    status: row.status as any,
    source: row.source as any,
    attendantName: (row.user?.name ?? row.user?.email ?? "—").toString(),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Online summary</h1>
        <p className="text-sm text-slate-400">
          Current trading period: {period.label}. Snapshot below uses the last 4 full Monday–Sunday weeks within this
          period.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/admin/online/summary"
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              period.key === currentPeriod.key
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-slate-200 hover:bg-white/5"
            }`}
          >
            Current period
          </Link>
          <Link
            href={`/admin/online/summary?periodKey=${encodeURIComponent(lastPeriod.key)}`}
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

      <section className="rounded-2xl border border-white/10 bg-slate-900/30 px-6 py-4 text-sm text-slate-200">
        Quick links:{" "}
        <Link className="font-semibold text-emerald-200 hover:text-emerald-100" href="/admin/online/email-intelligence">
          Email intelligence
        </Link>
        {" · "}
        <Link className="font-semibold text-emerald-200 hover:text-emerald-100" href="/admin/online/divided">
          Divided view
        </Link>
        {" · "}
        <Link className="font-semibold text-emerald-200 hover:text-emerald-100" href="/admin/online/manual">
          Manual weekly sales
        </Link>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Summary (last 4 weeks)</h2>
            <p className="text-sm text-slate-400">Per shop and attendant totals for Jumia & Kilimall.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/online/summary?periodKey=${encodeURIComponent(previousPeriod.key)}`}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              ← Previous period
            </Link>
            <Link
              href={`/admin/online/summary?periodKey=${encodeURIComponent(nextPeriod.key)}`}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Next period →
            </Link>
            <Link
              href="/admin/online/manual"
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
            >
              Open manual sales desk
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Weeks (last 4)</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              {last4Weeks.map((wk) => (
                <Link
                  key={wk.key}
                  href={`/admin/online/summary?periodKey=${encodeURIComponent(period.key)}&weekStart=${encodeURIComponent(wk.startInput)}`}
                  className={`block rounded-xl border px-3 py-2 hover:bg-white/5 ${
                    wk.startInput === selectedWeekKey ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="font-semibold text-white">{wk.label}</div>
                  <div className="text-xs text-slate-400">Week start: {wk.startInput}</div>
                </Link>
              ))}
            </div>
            {selectedWeekWindow && (
              <div className="mt-4">
                <Link
                  href={`/admin/online/summary?periodKey=${encodeURIComponent(period.key)}`}
                  className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
                >
                  Clear week selection →
                </Link>
              </div>
            )}
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
                      <th className="py-2 pr-4">Report</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2 pr-4 text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendantTotalRows.map((row) => (
                      <tr key={row.attendantId ?? "none"} className="border-t border-white/5">
                        <td className="py-3 pr-4 text-slate-200">{row.attendantName}</td>
                        <td className="py-3 pr-4">
                          {row.attendantId ? (
                            <a
                              href={`/api/admin/online/attendant-performance-pdf?attendantId=${encodeURIComponent(
                                row.attendantId,
                              )}&periodKey=${encodeURIComponent(period.key)}`}
                              className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/5"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Download PDF
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-emerald-300">
                          {currencyFormatter.format(row.total)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {row.attendantId && canDownloadOnlineSummaryIndividual(row.attendantEmail) ? (
                            <a
                              href={`/api/admin/online/summary/individual-export?userId=${encodeURIComponent(
                                row.attendantId,
                              )}&periodKey=${encodeURIComponent(period.key)}`}
                              className="inline-flex items-center justify-center rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10"
                            >
                              Download PDF
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!attendantTotalRows.length && (
                      <tr>
                        <td className="py-3 pr-4 text-slate-400" colSpan={3}>
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

        {selectedWeekWindow && (
          <ManualWeekViewClient
            weekLabel={`${formatNairobiDate(selectedWeekWindow.weekStart)} – ${formatNairobiDate(
              new Date(selectedWeekWindow.weekEnd.getTime() - MS_PER_DAY),
            )}`}
            shops={onlineShops.map((shop) => ({
              id: shop.id,
              shopName: shop.shopName,
              displayName: shop.displayName,
              platform: shop.platform,
              primaryAttendant: shop.primaryAttendant,
            }))}
            entries={weekEntries}
          />
        )}
      </section>
    </div>
  );
}
