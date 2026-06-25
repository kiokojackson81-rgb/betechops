import { prisma } from "@/lib/prisma";

export async function getVoiceHealthSnapshot() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const [
    activeCalls,
    queuedCalls,
    recentEvents,
    availableAgents,
    staleAgents,
    recordingsToday,
  ] = await Promise.all([
    prisma.voiceCall.count({
      where: {
        OR: [
          { isActive: true },
          { status: { in: ["queued", "ringing", "initiated", "dialing", "in_progress", "answered"] } },
        ],
      },
    }),
    prisma.voiceCall.count({
      where: {
        status: { in: ["queued", "ringing", "initiated", "dialing", "new", "pending"] },
      },
    }),
    prisma.voiceEvent.count({
      where: {
        createdAt: { gte: fiveMinutesAgo },
      },
    }),
    prisma.voiceAgentPresence.count({
      where: {
        status: "AVAILABLE",
        lastSeenAt: { gte: fiveMinutesAgo },
      },
    }),
    prisma.voiceAgentPresence.count({
      where: {
        lastSeenAt: { lt: thirtyMinutesAgo },
      },
    }),
    prisma.voiceCall.count({
      where: {
        recordingUrl: { not: null },
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    }),
  ]);

  return {
    ok: true,
    checkedAt: now.toISOString(),
    activeCalls,
    queuedCalls,
    recentEvents,
    availableAgents,
    staleAgents,
    recordingsToday,
  };
}
