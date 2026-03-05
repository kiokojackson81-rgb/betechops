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
import { redirect } from "next/navigation";
import Link from "next/link";
import ManualWeekViewClient from "@/app/admin/online/summary/_components/ManualWeekView.client";
import DividedViewClient from "@/app/admin/online/summary/_components/DividedView.client";
import EmailSyncButtonClient from "@/app/admin/online/summary/_components/EmailSyncButton.client";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NAIROBI_TZ = "Africa/Nairobi";
const NAIROBI_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: NAIROBI_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function nairobiDayWindowUtc(reference = new Date()): { dayIso: string; startUtc: Date; endUtc: Date } {
  const parts = NAIROBI_DATE_ONLY_FORMATTER.formatToParts(reference);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "");
  const dayIso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Nairobi is UTC+3, so Nairobi midnight == 21:00Z previous day.
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + MS_PER_DAY);
  return { dayIso, startUtc, endUtc };
}

type SearchParams = {
  periodKey?: string;
  weekStart?: string;
  view?: string;
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
  const view = (resolvedParams.view ?? "manual").toString();

  const previousPeriod = getPreviousTradingPeriod(period);
  const nextPeriod = getNextTradingPeriod(period);
  const currentPeriod = getTradingPeriodFor(new Date());
  const lastPeriod = getPreviousTradingPeriod(currentPeriod);

  const emailWindow = nairobiDayWindowUtc(now);
  const todayDateOnlyUtc = parseDateOnlyUtc(emailWindow.dayIso);

  const [manualWeeklyRows, onlineShops, marketplaceEmailStats] = await Promise.all([
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
    (async () => {
      if (!todayDateOnlyUtc) {
        return {
          ok: false as const,
          error: "Could not determine Nairobi date window",
        };
      }

      try {
        const [statusCounts, lastMessage, todaysDigests, openReturnsByAccount, pendingKilimallByAccount, openAfterSales] =
          await Promise.all([
            prisma.marketplaceEmailMessage.groupBy({
              by: ["parseStatus"],
              where: { receivedAt: { gte: emailWindow.startUtc, lt: emailWindow.endUtc } },
              _count: { _all: true },
            }),
            prisma.marketplaceEmailMessage.findFirst({
              orderBy: { receivedAt: "desc" },
              select: { receivedAt: true },
            }),
            prisma.marketplaceDailyOrderDigest.findMany({
              where: { platform: "JUMIA", digestDate: todayDateOnlyUtc },
              include: { account: { select: { id: true, displayName: true, platform: true } } },
              orderBy: { account: { displayName: "asc" } },
            }),
            prisma.marketplaceReturn.groupBy({
              by: ["accountId"],
              where: { status: "WAITING_AT_HUB" },
              _count: { _all: true },
              _min: { dueAt: true },
            }),
            prisma.marketplaceOrder.groupBy({
              by: ["accountId"],
              where: { platform: "KILIMALL", status: "PENDING" },
              _count: { _all: true },
            }),
            prisma.marketplaceAfterSalesThread.findMany({
              where: { status: "OPEN" },
              orderBy: { receivedAt: "desc" },
              take: 50,
              include: { account: { select: { id: true, displayName: true, platform: true } }, sourceMessage: { select: { id: true } } },
            }),
          ]);

        const statusCountMap = new Map(statusCounts.map((r) => [r.parseStatus, r._count._all]));
        const parsedToday = statusCountMap.get("PARSED") ?? 0;
        const failedToday = statusCountMap.get("FAILED") ?? 0;
        const totalToday = Array.from(statusCountMap.values()).reduce((a, b) => a + b, 0);

        const accounts = await prisma.marketplaceAccount.findMany({
          where: { isActive: true },
          select: { id: true, displayName: true, platform: true },
          orderBy: { displayName: "asc" },
        });
        const accountsById = new Map(accounts.map((a) => [a.id, a]));

        const openReturnsRows = openReturnsByAccount
          .map((r) => ({
            accountId: r.accountId,
            accountName: accountsById.get(r.accountId)?.displayName ?? r.accountId,
            platform: accountsById.get(r.accountId)?.platform ?? "JUMIA",
            count: r._count._all,
            earliestDueAt: r._min.dueAt ?? null,
          }))
          .sort((a, b) => b.count - a.count);

        const pendingKilimallRows = pendingKilimallByAccount
          .map((r) => ({
            accountId: r.accountId,
            accountName: accountsById.get(r.accountId)?.displayName ?? r.accountId,
            platform: accountsById.get(r.accountId)?.platform ?? "KILIMALL",
            count: r._count._all,
          }))
          .sort((a, b) => b.count - a.count);

        const digestTotals = todaysDigests.reduce(
          (acc, d) => ({
            newOrders: acc.newOrders + (d.newOrders ?? 0),
            pending: acc.pending + (d.pendingToday ?? 0),
            delivered: acc.delivered + (d.deliveredToday ?? 0),
            returned: acc.returned + (d.returnedToday ?? 0),
          }),
          { newOrders: 0, pending: 0, delivered: 0, returned: 0 },
        );

        const returnsWaitingPickup = openReturnsRows.reduce((sum, r) => sum + r.count, 0);
        const kilimallPendingTotal = pendingKilimallRows.reduce((sum, r) => sum + r.count, 0);

        return {
          ok: true as const,
          dayIso: emailWindow.dayIso,
          lastMessageAt: lastMessage?.receivedAt ?? null,
          totalToday,
          parsedToday,
          failedToday,
          digestTotals,
          todaysDigests,
          openReturnsRows,
          returnsWaitingPickup,
          pendingKilimallRows,
          kilimallPendingTotal,
          openAfterSales,
        };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })(),
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

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/admin/online/summary?periodKey=${encodeURIComponent(period.key)}${selectedWeekKey ? `&weekStart=${encodeURIComponent(selectedWeekKey)}` : ""}&view=manual`}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              view === "manual"
                ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                : "border-white/10 text-slate-200 hover:bg-white/5"
            }`}
          >
            Manual weekly
          </Link>
          <Link
            href={`/admin/online/summary?periodKey=${encodeURIComponent(period.key)}${selectedWeekKey ? `&weekStart=${encodeURIComponent(selectedWeekKey)}` : ""}&view=divided`}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              view === "divided"
                ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                : "border-white/10 text-slate-200 hover:bg-white/5"
            }`}
          >
            Divided
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Marketplace email intelligence</p>
            <h2 className="text-lg font-semibold text-white">Inbox tracking (Jumia + Kilimall)</h2>
            <p className="text-sm text-slate-400">
              Daily digests, returns awaiting pickup and Kilimall pending/after-sales emails. Date shown uses Nairobi day:{" "}
              <span className="font-semibold text-slate-200">
                {marketplaceEmailStats.ok ? marketplaceEmailStats.dayIso : emailWindow.dayIso}
              </span>
              .
            </p>
          </div>
          <EmailSyncButtonClient />
        </div>

        {!marketplaceEmailStats.ok ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Email dashboard unavailable: {marketplaceEmailStats.error}
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-6">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Jumia new orders</p>
                <p className="mt-2 text-2xl font-semibold text-white">{marketplaceEmailStats.digestTotals.newOrders}</p>
                <p className="text-xs text-slate-400">Today</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Jumia pending</p>
                <p className="mt-2 text-2xl font-semibold text-white">{marketplaceEmailStats.digestTotals.pending}</p>
                <p className="text-xs text-slate-400">Today</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Returns waiting pickup</p>
                <p className="mt-2 text-2xl font-semibold text-white">{marketplaceEmailStats.returnsWaitingPickup}</p>
                <p className="text-xs text-slate-400">Waiting at hub</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Kilimall pending</p>
                <p className="mt-2 text-2xl font-semibold text-white">{marketplaceEmailStats.kilimallPendingTotal}</p>
                <p className="text-xs text-slate-400">Orders</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Parsed today</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-200">{marketplaceEmailStats.parsedToday}</p>
                <p className="text-xs text-slate-400">Emails</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Failed today</p>
                <p className="mt-2 text-2xl font-semibold text-rose-200">{marketplaceEmailStats.failedToday}</p>
                <p className="text-xs text-slate-400">
                  Last received{" "}
                  {marketplaceEmailStats.lastMessageAt ? formatNairobiDate(new Date(marketplaceEmailStats.lastMessageAt)) : "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Today’s Jumia digest (per account)</h3>
                  <span className="text-xs text-slate-400">{marketplaceEmailStats.dayIso}</span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4 text-right">New</th>
                        <th className="py-2 pr-4 text-right">Pending</th>
                        <th className="py-2 pr-4 text-right">Delivered</th>
                        <th className="py-2 pr-4 text-right">Returned</th>
                        <th className="py-2 pr-4">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketplaceEmailStats.todaysDigests.map((d) => (
                        <tr key={d.id} className="border-t border-white/5">
                          <td className="py-3 pr-4 font-medium text-white">{d.account.displayName}</td>
                          <td className="py-3 pr-4 text-right text-slate-200">{d.newOrders}</td>
                          <td className="py-3 pr-4 text-right text-slate-200">{d.pendingToday}</td>
                          <td className="py-3 pr-4 text-right text-slate-200">{d.deliveredToday}</td>
                          <td className="py-3 pr-4 text-right text-slate-200">{d.returnedToday}</td>
                          <td className="py-3 pr-4 text-slate-200">
                            {d.lastReceivedAt ? formatNairobiDate(new Date(d.lastReceivedAt)) : "—"}
                          </td>
                        </tr>
                      ))}
                      {!marketplaceEmailStats.todaysDigests.length ? (
                        <tr>
                          <td className="py-3 pr-4 text-slate-400" colSpan={6}>
                            No Jumia daily digests parsed yet for today.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-white">Open returns (waiting at hub)</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4 text-right">Count</th>
                        <th className="py-2 pr-4">Earliest due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketplaceEmailStats.openReturnsRows.slice(0, 20).map((r) => (
                        <tr key={r.accountId} className="border-t border-white/5">
                          <td className="py-3 pr-4 font-medium text-white">{r.accountName}</td>
                          <td className="py-3 pr-4 text-right text-slate-200">{r.count}</td>
                          <td className="py-3 pr-4 text-slate-200">{r.earliestDueAt ? formatNairobiDate(new Date(r.earliestDueAt)) : "—"}</td>
                        </tr>
                      ))}
                      {!marketplaceEmailStats.openReturnsRows.length ? (
                        <tr>
                          <td className="py-3 pr-4 text-slate-400" colSpan={3}>
                            No open returns currently waiting at hub.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  See full list and status filters on{" "}
                  <Link className="font-semibold text-emerald-200 hover:text-emerald-100" href="/admin/online/returns">
                    Returns
                  </Link>
                  .
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-white">Kilimall pending orders (per account)</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketplaceEmailStats.pendingKilimallRows.slice(0, 20).map((r) => (
                        <tr key={r.accountId} className="border-t border-white/5">
                          <td className="py-3 pr-4 font-medium text-white">{r.accountName}</td>
                          <td className="py-3 pr-4 text-right text-slate-200">{r.count}</td>
                        </tr>
                      ))}
                      {!marketplaceEmailStats.pendingKilimallRows.length ? (
                        <tr>
                          <td className="py-3 pr-4 text-slate-400" colSpan={2}>
                            No pending Kilimall orders ingested yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-white">Kilimall after-sales (open)</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-4">Subject</th>
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4">Received</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketplaceEmailStats.openAfterSales.map((t) => (
                        <tr key={t.id} className="border-t border-white/5">
                          <td className="py-3 pr-4 font-medium text-white">{t.subject ?? "—"}</td>
                          <td className="py-3 pr-4 text-slate-200">{t.account?.displayName ?? "Unmapped"}</td>
                          <td className="py-3 pr-4 text-slate-200">{formatNairobiDate(new Date(t.receivedAt))}</td>
                          <td className="py-3 pr-4 text-slate-200">{t.status}</td>
                          <td className="py-3 pr-4">
                            <Link
                              className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
                              href={`/admin/online/emails/${t.sourceMessage.id}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {!marketplaceEmailStats.openAfterSales.length ? (
                        <tr>
                          <td className="py-3 pr-4 text-slate-400" colSpan={5}>
                            No open after-sales threads found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {view === "divided" ? (
        selectedWeekKey ? (
          <DividedViewClient weekStart={selectedWeekKey} periodKey={period.key} />
        ) : (
          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">Divided</h2>
            <p className="mt-1 text-sm text-slate-400">Select a week from the left panel to view divided calculations.</p>
          </section>
        )
      ) : null}

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
