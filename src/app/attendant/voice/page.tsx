import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withImpersonateId } from "@/lib/impersonation";

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

        <section className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Assigned Calls</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Recent Voice Activity</h2>
          <div className="mt-4 grid gap-3">
            {assignedCalls.length ? assignedCalls.map((call) => (
              <div key={call.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-white">{call.callerNumber}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {call.status.replace(/_/g, " ")} · {call.routedTo || "No route saved"}
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">{formatDateTime(call.startedAt ?? call.createdAt)}</div>
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
            {followUps.length ? followUps.map((lead) => (
              <div key={lead.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="font-semibold text-white">{lead.phone}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {lead.status.replace(/_/g, " ")} · Last call {formatDateTime(lead.lastCallAt)}
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
