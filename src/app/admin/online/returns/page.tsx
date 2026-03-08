import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarketplaceReturnStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import MarketplaceDataFallback from "../_components/MarketplaceDataFallback";

export const dynamic = "force-dynamic";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NAIROBI_TZ = "Africa/Nairobi";
const NAIROBI_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: NAIROBI_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const statusLabels: Record<MarketplaceReturnStatus, string> = {
  WAITING_AT_HUB: "Waiting at hub",
  PICKED: "Picked",
  CHARGED_TO_ATTENDANT: "Charged to attendant",
};

function nairobiDayWindowUtc(reference = new Date()): { dayIso: string; startUtc: Date; endUtc: Date } {
  const parts = NAIROBI_DATE_ONLY_FORMATTER.formatToParts(reference);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "");
  const dayIso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + MS_PER_DAY);
  return { dayIso, startUtc, endUtc };
}

function nairobiDayWindowUtcFromIso(dayIso: string): { dayIso: string; startUtc: Date; endUtc: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayIso)) return null;
  const [y, m, d] = dayIso.split("-").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + MS_PER_DAY);
  return { dayIso, startUtc, endUtc };
}

export default async function AdminOnlineReturnsPage(props: any) {
  const searchParams = props?.searchParams as Record<string, string | string[] | undefined> | undefined;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  const rawStatus = searchParams?.status;
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const normalizedStatus = statusParam?.toUpperCase() as MarketplaceReturnStatus | undefined;
  const prismaStatusFilter =
    normalizedStatus && Object.keys(statusLabels).includes(normalizedStatus) ? normalizedStatus : undefined;
  const selectedStatus = prismaStatusFilter;

  const rawPeriod = searchParams?.period;
  const periodParam = (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod)?.toLowerCase() ?? "last24h";
  const rawDay = searchParams?.day;
  const dayParam = Array.isArray(rawDay) ? rawDay[0] : rawDay;
  const now = new Date();
  const todayWindow = nairobiDayWindowUtc(now);
  const yesterdayWindow = nairobiDayWindowUtc(new Date(now.getTime() - MS_PER_DAY));
  const customDayWindow = dayParam ? nairobiDayWindowUtcFromIso(dayParam) : null;

  let periodWhere: any = undefined;
  if (periodParam === "last24h") {
    const start = new Date(now.getTime() - MS_PER_DAY);
    periodWhere = {
      OR: [
        { sourceEmailMessage: { receivedAt: { gte: start, lt: now } } },
        { sourceEmailMessageId: null, createdAt: { gte: start, lt: now } },
      ],
    };
  } else if (periodParam === "today") {
    periodWhere = {
      OR: [
        { sourceEmailMessage: { receivedAt: { gte: todayWindow.startUtc, lt: todayWindow.endUtc } } },
        { sourceEmailMessageId: null, createdAt: { gte: todayWindow.startUtc, lt: todayWindow.endUtc } },
      ],
    };
  } else if (periodParam === "yesterday") {
    periodWhere = {
      OR: [
        { sourceEmailMessage: { receivedAt: { gte: yesterdayWindow.startUtc, lt: yesterdayWindow.endUtc } } },
        { sourceEmailMessageId: null, createdAt: { gte: yesterdayWindow.startUtc, lt: yesterdayWindow.endUtc } },
      ],
    };
  } else if (periodParam === "day" && customDayWindow) {
    periodWhere = {
      OR: [
        { sourceEmailMessage: { receivedAt: { gte: customDayWindow.startUtc, lt: customDayWindow.endUtc } } },
        { sourceEmailMessageId: null, createdAt: { gte: customDayWindow.startUtc, lt: customDayWindow.endUtc } },
      ],
    };
  }

  type ReturnGroup = { status: MarketplaceReturnStatus; _count: { _all: number } };
  type ReturnRow = {
    id: string;
    status: MarketplaceReturnStatus;
    orderItemId: string;
    platform: string;
    dueAt: Date;
    createdAt: Date;
    expectedAmount: unknown;
    accountName: string;
    accountPlatform: string;
    attendantName: string | null;
    attendantEmail: string | null;
    sourceReceivedAt: Date | null;
    stationName: string | null;
    trackingNumber: string;
    orderNumber: string | null;
    itemDescription: string | null;
    remainingDays: number | null;
  };
  let counts: ReturnGroup[] | null = null;
  let returns: ReturnRow[] | null = null;
  try {
    const [groupCounts, returnEntries] = await Promise.all([
      prisma.marketplaceReturn.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.marketplaceReturn.findMany({
        where: {
          ...(prismaStatusFilter ? { status: prismaStatusFilter } : {}),
          ...(periodWhere ?? {}),
        },
        include: {
          account: { select: { displayName: true, platform: true } },
          attendant: { select: { name: true, email: true } },
          sourceEmailMessage: { select: { receivedAt: true } },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);
    counts = groupCounts;
    returns = returnEntries.map((entry: any) => ({
      ...(function () {
        const payload = entry.rawPayload && typeof entry.rawPayload === "object" ? entry.rawPayload : {};
        const stationName = typeof payload.stationName === "string" ? payload.stationName : null;
        const trackingNumber = typeof payload.trackingNumber === "string" ? payload.trackingNumber : entry.orderItemId;
        const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber : null;
        const itemDescription = typeof payload.itemDescription === "string" ? payload.itemDescription : null;
        const remainingDays = Number.isFinite(Number(payload.remainingDays)) ? Number(payload.remainingDays) : null;
        return { stationName, trackingNumber, orderNumber, itemDescription, remainingDays };
      })(),
      id: entry.id,
      status: entry.status,
      orderItemId: entry.orderItemId,
      platform: entry.platform,
      dueAt: entry.dueAt,
      createdAt: entry.createdAt,
      expectedAmount: entry.expectedAmount,
      accountName: entry.account.displayName,
      accountPlatform: entry.account.platform,
      attendantName: entry.attendant?.name ?? null,
      attendantEmail: entry.attendant?.email ?? null,
      sourceReceivedAt: entry.sourceEmailMessage?.receivedAt ?? null,
    }));
  } catch (err) {
    console.error("Admin online returns failed to load data:", err);
  }

  if (!counts || !returns) {
    return (
      <MarketplaceDataFallback
        title="Marketplace returns unavailable"
        reason="We could not query marketplace return groups or the most recent cases. Double-check that the online ops migrations ran successfully (MarketplaceReturn & related tables) before refreshing."
        className="mt-4"
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400">Returns</p>
        <h2 className="text-xl font-semibold text-white">Marketplace returns & deductions</h2>
        <p className="text-sm text-slate-400">
          Track cases that still need action before nightly deductions kick in. Use the filters to focus on a specific
          status.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(() => {
          const periodQuery =
            periodParam === "day" && customDayWindow
              ? `period=day&day=${encodeURIComponent(customDayWindow.dayIso)}`
              : `period=${encodeURIComponent(periodParam)}`;
          return Object.entries(statusLabels).map(([statusKey, label]) => {
            const status = statusKey as MarketplaceReturnStatus;
            const count = counts.find((entry) => entry.status === status)?._count._all ?? 0;
            const isActive = selectedStatus === status;
            const href = isActive ? `/admin/online/returns?${periodQuery}` : `/admin/online/returns?status=${status}&${periodQuery}`;
            return (
              <a
                key={status}
                href={href}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                    : "border-white/15 text-slate-200 hover:border-emerald-400/60 hover:text-emerald-200"
                }`}
              >
                {label} ({count})
              </a>
            );
          });
        })()}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "Last 24h",
            href: `/admin/online/returns${selectedStatus ? `?status=${selectedStatus}&period=last24h` : "?period=last24h"}`,
            active: periodParam === "last24h",
          },
          {
            label: "Today",
            href: `/admin/online/returns${selectedStatus ? `?status=${selectedStatus}&period=today` : "?period=today"}`,
            active: periodParam === "today",
          },
          {
            label: "Yesterday",
            href: `/admin/online/returns${selectedStatus ? `?status=${selectedStatus}&period=yesterday` : "?period=yesterday"}`,
            active: periodParam === "yesterday",
          },
          {
            label: "All",
            href: `/admin/online/returns${selectedStatus ? `?status=${selectedStatus}&period=all` : "?period=all"}`,
            active: periodParam === "all",
          },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              item.active
                ? "border-cyan-400 bg-cyan-500/10 text-cyan-100"
                : "border-white/15 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/30">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3 text-right">Returns</th>
              <th className="px-4 py-3">Earliest due</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(
              returns.reduce((map, item) => {
                const key = item.accountName;
                const current = map.get(key) ?? { accountName: item.accountName, count: 0, earliestDueAt: item.dueAt };
                current.count += 1;
                if (item.dueAt.getTime() < current.earliestDueAt.getTime()) current.earliestDueAt = item.dueAt;
                map.set(key, current);
                return map;
              }, new Map<string, { accountName: string; count: number; earliestDueAt: Date }>()),
            )
              .map(([, v]) => v)
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <tr key={row.accountName} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold text-white">{row.accountName}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{row.count}</td>
                  <td className="px-4 py-3 text-slate-200">{row.earliestDueAt.toLocaleDateString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/30">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Return</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3 text-right">Expected amount</th>
              <th className="px-4 py-3">Due date</th>
              <th className="px-4 py-3">Email received</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((entry) => (
              <tr key={entry.id} className="border-t border-white/5">
                <td className="px-4 py-4">
                  <div className="font-semibold text-white">{statusLabels[entry.status]}</div>
                  <div className="text-xs text-slate-400">Order item #{entry.orderItemId}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-semibold text-white">{entry.accountName}</div>
                  <div className="text-xs text-slate-400 capitalize">{entry.accountPlatform.toLowerCase()}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-semibold text-white">{entry.trackingNumber}</div>
                  <div className="text-xs text-slate-400">Order #{entry.orderNumber ?? "—"}</div>
                  <div className="text-xs text-slate-400">{entry.stationName ?? "—"}</div>
                  <div className="text-xs text-slate-300">{entry.itemDescription ?? "—"}</div>
                </td>
                <td className="px-4 py-4 text-right text-slate-200">
                  {entry.remainingDays != null ? `${entry.remainingDays} day(s)` : "—"}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-emerald-200">
                  KES {Number(entry.expectedAmount).toLocaleString()}
                </td>
                <td className="px-4 py-4 text-sm text-slate-200">
                  <div>{entry.dueAt.toLocaleDateString()}</div>
                  <div className="text-xs text-slate-400">Created {entry.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-200">
                  {entry.sourceReceivedAt ? entry.sourceReceivedAt.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {returns.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={7}>
                  No return cases found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
        Returns are sourced from the nightly Jumia sync job. Once supervisors approve a case and confirm pickup, use the
        attendant tooling to update the underlying order state so the deductions are reconciled automatically.
      </div>
    </div>
  );
}
