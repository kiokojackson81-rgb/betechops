import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import EmailSyncButtonClient from "@/app/admin/online/summary/_components/EmailSyncButton.client";
import { formatNairobiDate, parseDateOnlyUtc } from "@/lib/weekWindow";
import ReprocessEmailsButtonClient from "@/app/admin/online/email-intelligence/_components/ReprocessEmailsButton.client";

export const dynamic = "force-dynamic";

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

function nairobiDayWindowUtcFromIso(dayIso: string): { dayIso: string; startUtc: Date; endUtc: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayIso)) return null;
  const d = parseDateOnlyUtc(dayIso);
  if (!d) return null;
  // parseDateOnlyUtc returns 00:00Z; Nairobi midnight is 21:00Z previous day.
  const startUtc = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + MS_PER_DAY);
  return { dayIso, startUtc, endUtc };
}

export default async function AdminOnlineEmailIntelligencePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }
  const isAdmin = role === "ADMIN";

  const now = new Date();
  const todayWindow = nairobiDayWindowUtc(now);
  const yesterdayWindow = nairobiDayWindowUtc(new Date(now.getTime() - MS_PER_DAY));

  const sp = (await props.searchParams) ?? {};
  const dayParam = Array.isArray(sp.day) ? sp.day[0] : sp.day;
  const selectedWindow = (dayParam ? nairobiDayWindowUtcFromIso(dayParam) : null) ?? todayWindow;
  const mailboxes = await prisma.marketplaceMailbox.findMany({
    where: { isActive: true },
    orderBy: { email: "asc" },
    include: { oauth: { select: { id: true, updatedAt: true, scope: true, tokenSource: true } } },
  });

  const stats = await (async () => {
    try {
      const [statusCounts, lastMessage, digestSnapshots, openReturnsByAccount, pendingKilimallByAccount, openAfterSales] =
        await Promise.all([
          prisma.marketplaceEmailMessage.groupBy({
            by: ["parseStatus"],
            where: { receivedAt: { gte: selectedWindow.startUtc, lt: selectedWindow.endUtc } },
            _count: { _all: true },
          }),
          prisma.marketplaceEmailMessage.findFirst({
            orderBy: { receivedAt: "desc" },
            select: { receivedAt: true },
          }),
          prisma.marketplaceDailyOrderDigestSnapshot.findMany({
            where: { platform: "JUMIA", receivedAt: { gte: selectedWindow.startUtc, lt: selectedWindow.endUtc } },
            include: { account: { select: { id: true, displayName: true, platform: true } } },
            orderBy: [{ receivedAt: "desc" }, { account: { displayName: "asc" } }],
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
            include: {
              account: { select: { id: true, displayName: true, platform: true } },
              sourceMessage: { select: { id: true } },
            },
          }),
        ]);

      const statusCountMap = new Map(statusCounts.map((r) => [r.parseStatus, r._count._all]));
      const parsedToday = statusCountMap.get("PARSED") ?? 0;
      const failedToday = statusCountMap.get("FAILED") ?? 0;

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

      const latestDigestByAccount = new Map<string, (typeof digestSnapshots)[number]>();
      for (const snapshot of digestSnapshots) {
        const prev = latestDigestByAccount.get(snapshot.accountId);
        if (!prev || snapshot.receivedAt.getTime() > prev.receivedAt.getTime()) {
          latestDigestByAccount.set(snapshot.accountId, snapshot);
        }
      }
      const todaysDigests = Array.from(latestDigestByAccount.values()).sort((a, b) =>
        a.account.displayName.localeCompare(b.account.displayName),
      );

      const digestTotals = todaysDigests.reduce(
        (acc, d) => ({
          newOrders: acc.newOrders + (d.newOrders ?? 0),
          pending: acc.pending + (d.pendingToday ?? 0),
          delivered: acc.delivered + (d.deliveredToday ?? 0),
          returned: acc.returned + (d.returnedToday ?? 0),
        }),
        { newOrders: 0, pending: 0, delivered: 0, returned: 0 },
      );

      const digestSnapshotTotals = digestSnapshots.reduce(
        (acc, s) => {
          const key = s.bucket === "MORNING" ? "morning" : "midday";
          acc[key].newOrders += s.newOrders ?? 0;
          acc[key].pending += s.pendingToday ?? 0;
          acc[key].delivered += s.deliveredToday ?? 0;
          acc[key].returned += s.returnedToday ?? 0;
          return acc;
        },
        {
          morning: { newOrders: 0, pending: 0, delivered: 0, returned: 0 },
          midday: { newOrders: 0, pending: 0, delivered: 0, returned: 0 },
        },
      );

      const returnsWaitingPickup = openReturnsRows.reduce((sum, r) => sum + r.count, 0);
      const kilimallPendingTotal = pendingKilimallRows.reduce((sum, r) => sum + r.count, 0);

      return {
        ok: true as const,
        dayIso: selectedWindow.dayIso,
        lastMessageAt: lastMessage?.receivedAt ?? null,
        parsedToday,
        failedToday,
        digestTotals,
        todaysDigests,
        digestSnapshots: digestSnapshots
          .slice()
          .sort((a, b) => (a.bucket === b.bucket ? a.account.displayName.localeCompare(b.account.displayName) : a.bucket.localeCompare(b.bucket))),
        digestSnapshotTotals,
        openReturnsRows,
        returnsWaitingPickup,
        pendingKilimallRows,
        kilimallPendingTotal,
        openAfterSales,
      };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  })();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Marketplace Email Intelligence</h1>
            <p className="text-sm text-slate-400">
              Daily digests, returns awaiting pickup and Kilimall pending/after-sales emails. Nairobi day:{" "}
              <span className="font-semibold text-slate-200">{selectedWindow.dayIso}</span>.
            </p>
          </div>
          <EmailSyncButtonClient />
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">View day</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className={`rounded-lg px-3 py-1.5 text-sm ${
              selectedWindow.dayIso === todayWindow.dayIso ? "bg-slate-800 text-white" : "text-slate-200 hover:bg-slate-950/30"
            }`}
            href="/admin/online/email-intelligence"
          >
            Today
          </Link>
          <Link
            className={`rounded-lg px-3 py-1.5 text-sm ${
              selectedWindow.dayIso === yesterdayWindow.dayIso
                ? "bg-slate-800 text-white"
                : "text-slate-200 hover:bg-slate-950/30"
            }`}
            href={`/admin/online/email-intelligence?day=${encodeURIComponent(yesterdayWindow.dayIso)}`}
          >
            Yesterday
          </Link>
          <form className="flex items-center gap-2" method="GET" action="/admin/online/email-intelligence">
            <input
              className="rounded-lg border border-white/10 bg-slate-950/30 px-2 py-1.5 text-sm text-slate-200"
              type="date"
              name="day"
              defaultValue={selectedWindow.dayIso}
            />
            <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700" type="submit">
              Go
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Mailboxes</p>
            <h2 className="mt-1 text-sm font-semibold text-white">Connected inboxes</h2>
          </div>
          <Link
            className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
            href="/api/admin/online/mailboxes"
          >
            View JSON →
          </Link>
        </div>

        {!mailboxes.length ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            No active mailboxes configured. Add one via <span className="font-semibold">POST /api/admin/online/mailboxes</span>{" "}
            with a Gmail refresh token, then sync again.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Mailbox</th>
                  <th className="px-4 py-3">OAuth</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Source</th>
                  {isAdmin ? <th className="px-4 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {mailboxes.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{m.displayName ?? m.email}</div>
                      <div className="text-xs text-slate-400">{m.email}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-200">{m.oauth ? "✅ Configured" : "—"}</td>
                    <td className="px-4 py-4 text-slate-200">
                      {m.oauth?.updatedAt ? formatNairobiDate(new Date(m.oauth.updatedAt)) : "—"}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-300">{m.oauth?.scope ?? "—"}</td>
                    <td className="px-4 py-4 text-xs text-slate-300">{m.oauth?.tokenSource ?? "—"}</td>
                    {isAdmin ? (
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <Link
                            className="text-xs font-semibold text-emerald-200 hover:text-emerald-100"
                            href={`/api/admin/online/email-messages?mailbox=${encodeURIComponent(m.email)}`}
                          >
                            List messages →
                          </Link>
                          <ReprocessEmailsButtonClient mailboxId={m.id} mailboxEmail={m.email} />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!stats.ok ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
          Email intelligence unavailable: {stats.error}
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
            <div className="grid gap-4 lg:grid-cols-6">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Jumia new orders</p>
                <p className="mt-2 text-2xl font-semibold text-white">{stats.digestTotals.newOrders}</p>
                <p className="text-xs text-slate-400">
                  By 7:30am: {stats.digestSnapshotTotals.morning.newOrders} · By 1:30pm: {stats.digestSnapshotTotals.midday.newOrders}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Jumia pending</p>
                <p className="mt-2 text-2xl font-semibold text-white">{stats.digestTotals.pending}</p>
                <p className="text-xs text-slate-400">
                  By 7:30am: {stats.digestSnapshotTotals.morning.pending} · By 1:30pm: {stats.digestSnapshotTotals.midday.pending}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Returns waiting pickup</p>
                <p className="mt-2 text-2xl font-semibold text-white">{stats.returnsWaitingPickup}</p>
                <p className="text-xs text-slate-400">Waiting at hub</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Kilimall pending</p>
                <p className="mt-2 text-2xl font-semibold text-white">{stats.kilimallPendingTotal}</p>
                <p className="text-xs text-slate-400">Orders</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Parsed today</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-200">{stats.parsedToday}</p>
                <p className="text-xs text-slate-400">Emails</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Failed today</p>
                <p className="mt-2 text-2xl font-semibold text-rose-200">{stats.failedToday}</p>
                <p className="text-xs text-slate-400">
                  Last received {stats.lastMessageAt ? formatNairobiDate(new Date(stats.lastMessageAt)) : "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Jumia digest (latest per account)</h2>
                <span className="text-xs text-slate-400">{stats.dayIso}</span>
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3 text-right">New</th>
                      <th className="px-4 py-3 text-right">Pending</th>
                      <th className="px-4 py-3 text-right">Delivered</th>
                      <th className="px-4 py-3 text-right">Returned</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.todaysDigests.map((d) => (
                      <tr key={d.id} className="border-t border-white/5">
                        <td className="px-4 py-4 font-medium text-white">{d.account.displayName}</td>
                        <td className="px-4 py-4 text-right text-slate-200">{d.newOrders}</td>
                        <td className="px-4 py-4 text-right text-slate-200">{d.pendingToday}</td>
                        <td className="px-4 py-4 text-right text-slate-200">{d.deliveredToday}</td>
                        <td className="px-4 py-4 text-right text-slate-200">{d.returnedToday}</td>
                        <td className="px-4 py-4 text-slate-200">{formatNairobiDate(new Date(d.receivedAt))}</td>
                      </tr>
                    ))}
                    {!stats.todaysDigests.length ? (
                      <tr>
                        <td className="px-4 py-6 text-slate-400" colSpan={6}>
                          No Jumia daily digests parsed yet for today.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Jumia digest snapshots (by 7:30am + by 1:30pm)</h3>
                  <span className="text-xs text-slate-400">{stats.dayIso}</span>
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Account</th>
                        <th className="px-4 py-3">Cutoff</th>
                        <th className="px-4 py-3 text-right">New</th>
                        <th className="px-4 py-3 text-right">Pending</th>
                        <th className="px-4 py-3 text-right">Delivered</th>
                        <th className="px-4 py-3 text-right">Returned</th>
                        <th className="px-4 py-3">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.digestSnapshots.map((s) => (
                        <tr key={s.id} className="border-t border-white/5">
                          <td className="px-4 py-4 font-medium text-white">{s.account.displayName}</td>
                          <td className="px-4 py-4 text-slate-200">{s.bucket === "MORNING" ? "By 7:30am" : "By 1:30pm"}</td>
                          <td className="px-4 py-4 text-right text-slate-200">{s.newOrders}</td>
                          <td className="px-4 py-4 text-right text-slate-200">{s.pendingToday}</td>
                          <td className="px-4 py-4 text-right text-slate-200">{s.deliveredToday}</td>
                          <td className="px-4 py-4 text-right text-slate-200">{s.returnedToday}</td>
                          <td className="px-4 py-4 text-slate-200">{formatNairobiDate(new Date(s.receivedAt))}</td>
                        </tr>
                      ))}
                      {!stats.digestSnapshots.length ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-400" colSpan={7}>
                            No Jumia digest snapshots stored yet for this day.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold text-white">Open returns (waiting at hub)</h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3 text-right">Count</th>
                      <th className="px-4 py-3">Earliest due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.openReturnsRows.slice(0, 20).map((r) => (
                      <tr key={r.accountId} className="border-t border-white/5">
                        <td className="px-4 py-4 font-medium text-white">{r.accountName}</td>
                        <td className="px-4 py-4 text-right text-slate-200">{r.count}</td>
                        <td className="px-4 py-4 text-slate-200">
                          {r.earliestDueAt ? formatNairobiDate(new Date(r.earliestDueAt)) : "—"}
                        </td>
                      </tr>
                    ))}
                    {!stats.openReturnsRows.length ? (
                      <tr>
                        <td className="px-4 py-6 text-slate-400" colSpan={3}>
                          No open returns currently waiting at hub.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                See full list on{" "}
                <Link className="font-semibold text-emerald-200 hover:text-emerald-100" href="/admin/online/returns">
                  Returns
                </Link>
                .
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold text-white">Kilimall pending orders (per account)</h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.pendingKilimallRows.slice(0, 20).map((r) => (
                      <tr key={r.accountId} className="border-t border-white/5">
                        <td className="px-4 py-4 font-medium text-white">{r.accountName}</td>
                        <td className="px-4 py-4 text-right text-slate-200">{r.count}</td>
                      </tr>
                    ))}
                    {!stats.pendingKilimallRows.length ? (
                      <tr>
                        <td className="px-4 py-6 text-slate-400" colSpan={2}>
                          No pending Kilimall orders ingested yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
              <h2 className="text-sm font-semibold text-white">Kilimall after-sales (open)</h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Received</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.openAfterSales.map((t) => (
                      <tr key={t.id} className="border-t border-white/5">
                        <td className="px-4 py-4 font-medium text-white">{t.subject ?? "—"}</td>
                        <td className="px-4 py-4 text-slate-200">{t.account?.displayName ?? "Unmapped"}</td>
                        <td className="px-4 py-4 text-slate-200">{formatNairobiDate(new Date(t.receivedAt))}</td>
                        <td className="px-4 py-4 text-slate-200">{t.status}</td>
                        <td className="px-4 py-4">
                          <Link
                            className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
                            href={`/admin/online/emails/${t.sourceMessage.id}`}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {!stats.openAfterSales.length ? (
                      <tr>
                        <td className="px-4 py-6 text-slate-400" colSpan={5}>
                          No open after-sales threads found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
        Tip: If data looks stale, click <span className="font-semibold">Sync now</span>. For raw email bodies, use the{" "}
        <span className="font-semibold">View</span> links under after-sales.
      </div>
    </div>
  );
}
