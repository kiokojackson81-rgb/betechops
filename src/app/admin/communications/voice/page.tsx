import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatKes(value: Prisma.Decimal | number | null | undefined, currencyCode = "KES") {
  const amount = Number(value ?? 0);
  return `${currencyCode} ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
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

export default async function AdminVoiceDashboardPage() {
  const session = await auth();
  const user = session?.user as { role?: string | null } | undefined;
  if (!session) redirect("/admin/login");
  if (user?.role !== "ADMIN") redirect("/not-authorized");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [callsToday, answeredCalls, activeCalls, recentCalls, missedLeads] = await Promise.all([
    prisma.voiceCall.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.voiceCall.count({
      where: {
        createdAt: { gte: todayStart },
        status: { in: ["completed", "COMPLETED", "answered", "ANSWERED", "in_progress", "IN_PROGRESS"] },
      },
    }),
    prisma.voiceCall.count({
      where: { isActive: true },
    }),
    prisma.voiceCall.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      include: {
        assignedTo: { select: { name: true, email: true } },
      },
    }),
    prisma.voiceLead.findMany({
      where: { status: { in: ["open", "pending_follow_up"] } },
      orderBy: [{ updatedAt: "desc" }],
      take: 10,
      include: {
        assignedTo: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,6,23,.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Communication Center
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white">Voice Calls Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Monitor incoming voice sessions, routing outcomes, missed call follow-ups, and recordings from Africa&apos;s Talking.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.06]"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Calls Today</div>
            <div className="mt-3 text-3xl font-semibold text-white">{callsToday}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Answered / Completed</div>
            <div className="mt-3 text-3xl font-semibold text-white">{answeredCalls}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Active Calls</div>
            <div className="mt-3 text-3xl font-semibold text-white">{activeCalls}</div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recent Calls</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Call History</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Caller Number</th>
                  <th className="pb-3 pr-4">Direction</th>
                  <th className="pb-3 pr-4">Routed To</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Duration</th>
                  <th className="pb-3 pr-4">Cost</th>
                  <th className="pb-3">Recording</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.length ? recentCalls.map((call) => (
                  <tr key={call.id} className="border-t border-white/10 text-slate-300">
                    <td className="py-3 pr-4">{formatDateTime(call.startedAt ?? call.createdAt)}</td>
                    <td className="py-3 pr-4 text-white">{call.callerNumber}</td>
                    <td className="py-3 pr-4">{call.direction}</td>
                    <td className="py-3 pr-4">
                      <div>{call.routedTo || "-"}</div>
                      <div className="text-xs text-slate-500">{call.assignedTo?.name || call.assignedTo?.email || "-"}</div>
                    </td>
                    <td className="py-3 pr-4 capitalize">{call.status.replace(/_/g, " ")}</td>
                    <td className="py-3 pr-4">{formatDuration(call.durationInSeconds)}</td>
                    <td className="py-3 pr-4">{formatKes(call.amount, call.currencyCode || "KES")}</td>
                    <td className="py-3">
                      {call.recordingUrl ? (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-300 underline-offset-4 hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-slate-400">No voice calls recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Missed Call Follow-ups</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Pending Voice Leads</h2>
          <div className="mt-4 grid gap-3">
            {missedLeads.length ? missedLeads.map((lead) => (
              <div key={lead.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-white">{lead.phone}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {lead.assignedTo?.name || lead.assignedTo?.email || "Unassigned"} · {lead.status.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">
                    Last call: {formatDateTime(lead.lastCallAt)}
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                No missed-call follow-ups yet.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
