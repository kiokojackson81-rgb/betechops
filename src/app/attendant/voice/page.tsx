import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withImpersonateId } from "@/lib/impersonation";
import { getVoiceCustomerContext } from "@/lib/voiceCustomerContext";

export const dynamic = "force-dynamic";

function canAccessVoiceDesk(role: string | null | undefined, attendantCategory: string | null | undefined) {
  return (
    role === "ADMIN" ||
    attendantCategory === "DIRECT_SALES_OPS" ||
    attendantCategory === "MARKETING_OPS"
  );
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return value.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (!mins) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

type PageProps = {
  searchParams?: Promise<{ impersonateId?: string }>;
};

export default async function AttendantVoicePage({ searchParams }: PageProps) {
  const session = await auth();
  const user = session?.user as {
    id?: string | null;
    role?: string | null;
    attendantCategory?: string | null;
  } | undefined;

  if (!session) redirect("/attendant/login");
  if (!canAccessVoiceDesk(user?.role, user?.attendantCategory)) {
    redirect("/not-authorized");
  }

  const params = (await searchParams) || {};
  const targetUserId = user?.role === "ADMIN" && params.impersonateId ? params.impersonateId : (user?.id ?? null);
  const backHref =
    user?.attendantCategory === "DIRECT_SALES_OPS"
      ? withImpersonateId("/marketing/tracker", params.impersonateId)
      : withImpersonateId("/attendant/daily-report", params.impersonateId);

  const [assignedCalls, followUps] = await Promise.all([
    targetUserId
      ? prisma.voiceCall.findMany({
          where: { assignedToId: targetUserId },
          orderBy: [{ createdAt: "desc" }],
          take: 20,
        })
      : Promise.resolve([]),
    targetUserId
      ? prisma.voiceLead.findMany({
          where: { assignedToId: targetUserId, status: { in: ["open", "pending_follow_up"] } },
          orderBy: [{ updatedAt: "desc" }],
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  const [callContexts, leadContexts] = await Promise.all([
    Promise.all(
      assignedCalls.map(async (call) => ({
        call,
        context: await getVoiceCustomerContext(call.callerNumber, { take: 4 }),
      })),
    ),
    Promise.all(
      followUps.map(async (lead) => ({
        lead,
        context: await getVoiceCustomerContext(lead.phone, { take: 4 }),
      })),
    ),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const callsToday = assignedCalls.filter((call) => (call.startedAt ?? call.createdAt) >= todayStart).length;
  const missedToday = followUps.filter((lead) => (lead.lastCallAt ?? lead.createdAt) >= todayStart).length;
  const linkedCustomers = callContexts.filter(({ context }) => Boolean(context.matchedCustomer)).length;
  const createQuoteHref = withImpersonateId("/marketing/receipts?tab=quotations", params.impersonateId);
  const createReceiptHref = withImpersonateId("/receipts?view=create", params.impersonateId);
  const buildCustomerSearchHref = (phone: string) =>
    withImpersonateId(`/marketing/receipts?tab=pos&q=${encodeURIComponent(phone)}`, params.impersonateId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,6,23,.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Voice Calls
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white">Staff Voice Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                View voice calls assigned to you and follow up on missed callers from the call routing desk.
              </p>
            </div>
            <Link
              href={backHref}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Calls Today</div>
            <div className="mt-3 text-3xl font-semibold text-white">{callsToday}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Missed Follow-ups</div>
            <div className="mt-3 text-3xl font-semibold text-white">{missedToday}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Linked Customers</div>
            <div className="mt-3 text-3xl font-semibold text-white">{linkedCustomers}</div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Assigned Calls</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Customer Context Desk</h2>
          <div className="mt-4 grid gap-3">
            {callContexts.length ? callContexts.map(({ call, context }) => (
              <div key={call.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.1fr_1fr_220px]">
                  <div>
                    <div className="font-semibold text-white">{context.summary.customerName || call.callerNumber}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {call.callerNumber} · {call.status.replace(/_/g, " ")} · {formatDateTime(call.startedAt ?? call.createdAt)}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                      <div>Email: {context.summary.email || "-"}</div>
                      <div>Location: {context.summary.location || "-"}</div>
                      <div>Last purchase: {formatDateTime(context.summary.lastPurchaseAt)}</div>
                      <div>Total purchases: KES {context.summary.totalPurchasesValue.toLocaleString("en-KE")}</div>
                      <div>Open quotations: {context.summary.openQuotations}</div>
                      <div>Pending POD: {context.summary.pendingPod}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Recent activity</div>
                    <div className="mt-3 grid gap-2">
                      {context.timeline.length ? context.timeline.slice(0, 4).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm">
                          <div className="font-medium text-white">{item.title}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.detail}</div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm text-slate-400">
                          No linked customer history yet.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap content-start gap-2">
                    <Link
                      href={buildCustomerSearchHref(context.normalizedPhone || call.callerNumber)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
                    >
                      Open customer
                    </Link>
                    <Link
                      href={context.recentReceipts[0] ? withImpersonateId(`/marketing/receipts?tab=pos&receiptId=${encodeURIComponent(context.recentReceipts[0].id)}`, params.impersonateId) : createReceiptHref}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
                    >
                      Open receipt
                    </Link>
                    <Link
                      href={context.recentQuotations[0] ? withImpersonateId(`/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(context.recentQuotations[0].id)}`, params.impersonateId) : createQuoteHref}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-500/15"
                    >
                      Create quote
                    </Link>
                    <Link
                      href={createReceiptHref}
                      className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/15"
                    >
                      Create POS
                    </Link>
                    <div className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-xs text-slate-400">
                      Assigned: {context.assignedAgent?.name || call.routedTo || "No assignment"} · Call duration {formatDuration(call.durationInSeconds)}
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                No assigned calls yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Missed Calls</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Follow-up Queue</h2>
          <div className="mt-4 grid gap-3">
            {leadContexts.length ? leadContexts.map(({ lead, context }) => (
              <div key={lead.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold text-white">{context.summary.customerName || lead.phone}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {lead.phone} · {lead.status.replace(/_/g, " ")} · Last call {formatDateTime(lead.lastCallAt)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {context.recentWebOrders.length} web orders · {context.recentQuotations.length} quotes · {context.pendingPodReceipts.length} POD pending
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={buildCustomerSearchHref(context.normalizedPhone || lead.phone)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
                    >
                      Open customer
                    </Link>
                    <Link
                      href={createQuoteHref}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-500/15"
                    >
                      Create follow-up quote
                    </Link>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                No assigned calls yet.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
