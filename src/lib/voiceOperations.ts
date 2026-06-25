import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVoiceCustomerContext } from "@/lib/voiceCustomerContext";

export const VOICE_ALLOWED_ATTENDANT_CATEGORIES = ["DIRECT_SALES_OPS", "MARKETING_OPS"] as const;
export const VOICE_PRESENCE_STATUSES = ["AVAILABLE", "BUSY", "BREAK", "OFFLINE"] as const;

type VoicePresenceStatus = (typeof VOICE_PRESENCE_STATUSES)[number];

type ViewerOptions = {
  impersonateId?: string | null;
};

export type VoiceViewer = {
  actorUserId: string;
  actorRole: string | null;
  actorEmail: string | null;
  targetUserId: string;
  targetRole: string | null;
  targetAttendantCategory: string | null;
  isAdmin: boolean;
  impersonateId: string | null;
};

export type VoiceLiveSnapshotInput = {
  viewer: VoiceViewer;
  selectedCallId?: string | null;
  selectedPhone?: string | null;
};

export function canAccessVoiceDesk(role: string | null | undefined, attendantCategory: string | null | undefined) {
  return (
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    VOICE_ALLOWED_ATTENDANT_CATEGORIES.includes(
      String(attendantCategory || "") as (typeof VOICE_ALLOWED_ATTENDANT_CATEGORIES)[number],
    )
  );
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isCallActiveStatus(status: string | null | undefined) {
  return ["queued", "ringing", "initiated", "dialing", "in_progress", "answered", "processing"].includes(
    normalizeStatus(status),
  );
}

function isWaitingStatus(status: string | null | undefined) {
  return ["queued", "ringing", "initiated", "dialing", "new", "pending"].includes(normalizeStatus(status));
}

function isAnsweredStatus(status: string | null | undefined) {
  return ["answered", "in_progress", "completed"].includes(normalizeStatus(status));
}

function isMissedStatus(status: string | null | undefined) {
  return [
    "missed",
    "no_answer",
    "no answer",
    "busy",
    "failed",
    "unanswered",
    "not_answered",
    "not answered",
    "aborted",
  ].includes(normalizeStatus(status));
}

function formatStatusLabel(status: string | null | undefined) {
  return String(status || "unknown").replace(/_/g, " ");
}

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getCallStartedAt(call: { startedAt: Date | null; createdAt: Date }) {
  return call.startedAt ?? call.createdAt;
}

function getWaitingSeconds(call: { startedAt: Date | null; createdAt: Date; isActive: boolean }) {
  if (!call.isActive) return 0;
  const anchor = getCallStartedAt(call);
  return Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 1000));
}

function buildPhoneSearchHref(phone: string, impersonateId?: string | null) {
  const url = new URL("https://voice.local/admin/customers");
  url.pathname = "/admin/customers";
  url.searchParams.set("q", phone);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildReceiptHref(receiptId: string | null | undefined, impersonateId?: string | null) {
  const url = new URL("https://voice.local/marketing/receipts");
  url.pathname = "/marketing/receipts";
  url.searchParams.set("tab", "pos");
  if (receiptId) url.searchParams.set("receiptId", receiptId);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildQuoteHref(quoteId: string | null | undefined, impersonateId?: string | null) {
  const url = new URL("https://voice.local/marketing/receipts");
  url.pathname = "/marketing/receipts";
  url.searchParams.set("tab", "quotations");
  if (quoteId) url.searchParams.set("quoteId", quoteId);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildCreateReceiptHref(impersonateId?: string | null) {
  const url = new URL("https://voice.local/receipts");
  url.pathname = "/receipts";
  url.searchParams.set("view", "create");
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildVoiceHref(path: string, impersonateId?: string | null) {
  const url = new URL(`https://voice.local${path}`);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
}

export async function resolveVoiceViewer(options?: ViewerOptions): Promise<VoiceViewer | null> {
  const session = await auth();
  const user = session?.user as {
    id?: string | null;
    email?: string | null;
    role?: string | null;
    attendantCategory?: string | null;
  } | undefined;

  if (!session || !user?.id) return null;
  if (!canAccessVoiceDesk(user.role, user.attendantCategory)) return null;

  const isAdmin = user.role === "ADMIN";
  const impersonateId = isAdmin ? String(options?.impersonateId || "").trim() || null : null;

  if (impersonateId) {
    const target = await prisma.user.findUnique({
      where: { id: impersonateId },
      select: {
        id: true,
        role: true,
        attendantCategory: true,
      },
    });

    if (target && canAccessVoiceDesk(target.role, target.attendantCategory)) {
      return {
        actorUserId: user.id,
        actorRole: user.role ?? null,
        actorEmail: user.email?.toLowerCase() ?? null,
        targetUserId: target.id,
        targetRole: target.role,
        targetAttendantCategory: target.attendantCategory ?? null,
        isAdmin,
        impersonateId,
      };
    }
  }

  return {
    actorUserId: user.id,
    actorRole: user.role ?? null,
    actorEmail: user.email?.toLowerCase() ?? null,
    targetUserId: user.id,
    targetRole: user.role ?? null,
    targetAttendantCategory: user.attendantCategory ?? null,
    isAdmin,
    impersonateId,
  };
}

async function listVoiceAgents() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "ADMIN" },
        { attendantCategory: { in: [...VOICE_ALLOWED_ATTENDANT_CATEGORIES] } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      attendantCategory: true,
      voicePresence: {
        select: {
          id: true,
          status: true,
          lastSeenAt: true,
          currentCallId: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

function buildCallWhere(viewer: VoiceViewer) {
  if (viewer.isAdmin) return {};
  return { assignedToId: viewer.targetUserId };
}

function buildFollowUpWhere(viewer: VoiceViewer) {
  if (viewer.isAdmin) {
    return { status: { in: ["pending", "contacted"] } };
  }
  return {
    assignedToId: viewer.targetUserId,
    status: { in: ["pending", "contacted"] },
  };
}

function buildLeadWhere(viewer: VoiceViewer) {
  if (viewer.isAdmin) {
    return { status: { in: ["open", "pending_follow_up"] } };
  }
  return {
    assignedToId: viewer.targetUserId,
    status: { in: ["open", "pending_follow_up"] },
  };
}

function serializeCustomerContextSummary(context: Awaited<ReturnType<typeof getVoiceCustomerContext>>) {
  return {
    normalizedPhone: context.normalizedPhone,
    matchedCustomerId: context.matchedCustomer?.id ?? null,
    customerName: context.summary.customerName,
    email: context.summary.email,
    location: context.summary.location,
    assignedAgent: context.assignedAgent,
    lastPurchaseAt: toIso(context.summary.lastPurchaseAt),
    totalPurchasesValue: context.summary.totalPurchasesValue,
    openQuotations: context.summary.openQuotations,
    pendingWebOrders: context.summary.pendingWebOrders,
    pendingPod: context.summary.pendingPod,
    linkedRecords: {
      receipts: context.recentReceipts.length,
      webOrders: context.recentWebOrders.length,
      quotations: context.recentQuotations.length,
      agentOrders: context.recentAgentOrders.length,
      recentCalls: context.recentCalls.length,
      leads: context.followUps.length,
      taskFollowUps: context.taskFollowUps.length,
      notes: context.recentNotes.length,
    },
    latestReceiptId: context.recentReceipts[0]?.id ?? null,
    latestQuotationId: context.recentQuotations[0]?.id ?? null,
    recentTimeline: context.timeline.slice(0, 8).map((item) => ({
      ...item,
      at: item.at.toISOString(),
    })),
    recentNotes: context.recentNotes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
    })),
    taskFollowUps: context.taskFollowUps.map((task) => ({
      ...task,
      dueAt: toIso(task.dueAt),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}

function serializePresenceRow(
  agent: Awaited<ReturnType<typeof listVoiceAgents>>[number],
  activeCallCount: number,
  waitingCallCount: number,
) {
  return {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    role: agent.role,
    attendantCategory: agent.attendantCategory,
    status: String(agent.voicePresence?.status || "OFFLINE").toUpperCase(),
    lastSeenAt: toIso(agent.voicePresence?.lastSeenAt),
    updatedAt: toIso(agent.voicePresence?.updatedAt),
    currentCallId: agent.voicePresence?.currentCallId ?? null,
    activeCallCount,
    waitingCallCount,
  };
}

export async function getVoiceLiveSnapshot(input: VoiceLiveSnapshotInput) {
  const { viewer } = input;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const callWhere = buildCallWhere(viewer);
  const followUpWhere = buildFollowUpWhere(viewer);
  const leadWhere = buildLeadWhere(viewer);

  const [
    callsTodayCount,
    activeCallsRaw,
    recentCallsRaw,
    followUpsRaw,
    voiceLeadsRaw,
    voiceAgentsRaw,
    callCostAggregate,
    avgTalkAggregate,
    newVoiceLeadsCount,
  ] = await Promise.all([
    prisma.voiceCall.count({
      where: {
        ...callWhere,
        createdAt: { gte: todayStart },
      },
    }),
    prisma.voiceCall.findMany({
      where: {
        ...callWhere,
        OR: [{ isActive: true }, { status: { in: ["queued", "ringing", "initiated", "dialing", "in_progress", "answered"] } }],
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.voiceCall.findMany({
      where: callWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 16,
    }),
    prisma.voiceFollowUp.findMany({
      where: followUpWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        voiceCall: {
          select: {
            id: true,
            callerNumber: true,
            assignedToId: true,
            customerId: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 16,
    }),
    prisma.voiceLead.findMany({
      where: leadWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
    }),
    listVoiceAgents(),
    prisma.voiceCall.aggregate({
      where: {
        ...callWhere,
        createdAt: { gte: todayStart },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.voiceCall.aggregate({
      where: {
        ...callWhere,
        createdAt: { gte: todayStart },
        durationInSeconds: { not: null },
        status: { in: ["completed", "COMPLETED", "answered", "ANSWERED", "in_progress", "IN_PROGRESS"] },
      },
      _avg: {
        durationInSeconds: true,
      },
    }),
    prisma.voiceLead.count({
      where: {
        ...leadWhere,
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  const contextCache = new Map<string, Promise<Awaited<ReturnType<typeof getVoiceCustomerContext>>>>();
  const getContextForPhone = (phone: string) => {
    if (!contextCache.has(phone)) {
      contextCache.set(phone, getVoiceCustomerContext(phone, { take: 5 }));
    }
    return contextCache.get(phone)!;
  };

  const activeCalls = await Promise.all(
    activeCallsRaw.map(async (call) => {
      const context = await getContextForPhone(call.callerNumber);
      const contextSummary = serializeCustomerContextSummary(context);
      const lastActivity = contextSummary.recentTimeline[0] ?? null;
      return {
        id: call.id,
        sessionId: call.sessionId,
        callerNumber: call.callerNumber,
        direction: call.direction,
        status: call.status,
        statusLabel: formatStatusLabel(call.status),
        isActive: call.isActive || isCallActiveStatus(call.status),
        routedTo: call.routedTo,
        routeType: call.routeType,
        assignedToId: call.assignedToId,
        assignedToName: call.assignedTo?.name ?? null,
        assignedToEmail: call.assignedTo?.email ?? null,
        startedAt: toIso(call.startedAt),
        createdAt: call.createdAt.toISOString(),
        endedAt: toIso(call.endedAt),
        durationInSeconds: call.durationInSeconds ?? 0,
        waitingSeconds: getWaitingSeconds(call),
        amount: Number(call.amount ?? 0),
        currencyCode: call.currencyCode ?? "KES",
        recordingUrl: call.recordingUrl,
        customer: contextSummary,
        linkedSummaryText: `${contextSummary.linkedRecords.receipts} receipts · ${contextSummary.linkedRecords.webOrders} web orders · ${contextSummary.linkedRecords.quotations} quotes`,
        lastActivityTitle: lastActivity?.title ?? null,
        lastActivityAt: lastActivity?.at ?? null,
        links: {
          customer: buildPhoneSearchHref(contextSummary.normalizedPhone || call.callerNumber, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          createReceipt: buildCreateReceiptHref(viewer.impersonateId),
          agentOrders: buildVoiceHref("/marketing/agent-orders", viewer.impersonateId),
          callBack: `tel:${call.callerNumber}`,
        },
      };
    }),
  );

  const recentCalls = await Promise.all(
    recentCallsRaw.map(async (call) => {
      const context = await getContextForPhone(call.callerNumber);
      const contextSummary = serializeCustomerContextSummary(context);
      const lastActivity = contextSummary.recentTimeline[0] ?? null;
      return {
        id: call.id,
        sessionId: call.sessionId,
        callerNumber: call.callerNumber,
        direction: call.direction,
        status: call.status,
        statusLabel: formatStatusLabel(call.status),
        isActive: call.isActive || isCallActiveStatus(call.status),
        routedTo: call.routedTo,
        routeType: call.routeType,
        assignedToId: call.assignedToId,
        assignedToName: call.assignedTo?.name ?? null,
        assignedToEmail: call.assignedTo?.email ?? null,
        startedAt: toIso(call.startedAt),
        createdAt: call.createdAt.toISOString(),
        endedAt: toIso(call.endedAt),
        durationInSeconds: call.durationInSeconds ?? 0,
        waitingSeconds: getWaitingSeconds(call),
        amount: Number(call.amount ?? 0),
        currencyCode: call.currencyCode ?? "KES",
        recordingUrl: call.recordingUrl,
        customer: contextSummary,
        linkedSummaryText: `${contextSummary.linkedRecords.receipts} receipts · ${contextSummary.linkedRecords.webOrders} web orders · ${contextSummary.linkedRecords.quotations} quotes`,
        lastActivityTitle: lastActivity?.title ?? null,
        lastActivityAt: lastActivity?.at ?? null,
        links: {
          customer: buildPhoneSearchHref(contextSummary.normalizedPhone || call.callerNumber, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          createReceipt: buildCreateReceiptHref(viewer.impersonateId),
          agentOrders: buildVoiceHref("/marketing/agent-orders", viewer.impersonateId),
          callBack: `tel:${call.callerNumber}`,
        },
      };
    }),
  );

  const followUps = await Promise.all(
    followUpsRaw.map(async (task) => {
      const context = await getContextForPhone(task.phone);
      const contextSummary = serializeCustomerContextSummary(context);
      return {
        id: task.id,
        type: "task" as const,
        phone: task.phone,
        title: task.title,
        status: task.status,
        statusLabel: formatStatusLabel(task.status),
        notes: task.notes,
        dueAt: toIso(task.dueAt),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        assignedToId: task.assignedToId,
        assignedToName: task.assignedTo?.name ?? null,
        assignedToEmail: task.assignedTo?.email ?? null,
        voiceCallId: task.voiceCallId,
        voiceLeadId: task.voiceLeadId,
        customer: contextSummary,
        links: {
          customer: buildPhoneSearchHref(contextSummary.normalizedPhone || task.phone, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          callBack: `tel:${task.phone}`,
        },
      };
    }),
  );

  const taskLeadPhoneSet = new Set(followUps.map((task) => task.phone));
  const missedLeads = await Promise.all(
    voiceLeadsRaw
      .filter((lead) => !taskLeadPhoneSet.has(lead.phone))
      .map(async (lead) => {
        const context = await getContextForPhone(lead.phone);
        const contextSummary = serializeCustomerContextSummary(context);
        return {
          id: lead.id,
          type: "lead" as const,
          phone: lead.phone,
          title: lead.name || "Voice lead",
          status: lead.status,
          statusLabel: formatStatusLabel(lead.status),
          notes: null,
          dueAt: null,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
          assignedToId: lead.assignedToId,
          assignedToName: lead.assignedTo?.name ?? null,
          assignedToEmail: lead.assignedTo?.email ?? null,
          voiceCallId: null,
          voiceLeadId: lead.id,
          customer: contextSummary,
          links: {
            customer: buildPhoneSearchHref(contextSummary.normalizedPhone || lead.phone, viewer.impersonateId),
            quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
            receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
            callBack: `tel:${lead.phone}`,
          },
        };
      }),
  );

  const activeCallIdsByAgent = new Map<string, number>();
  const waitingCallIdsByAgent = new Map<string, number>();
  for (const call of activeCalls) {
    if (!call.assignedToId) continue;
    activeCallIdsByAgent.set(call.assignedToId, (activeCallIdsByAgent.get(call.assignedToId) ?? 0) + 1);
    if (isWaitingStatus(call.status)) {
      waitingCallIdsByAgent.set(call.assignedToId, (waitingCallIdsByAgent.get(call.assignedToId) ?? 0) + 1);
    }
  }

  const agents = voiceAgentsRaw.map((agent) =>
    serializePresenceRow(
      agent,
      activeCallIdsByAgent.get(agent.id) ?? 0,
      waitingCallIdsByAgent.get(agent.id) ?? 0,
    ),
  );

  const activeCallsCount = activeCalls.filter((call) => call.isActive).length;
  const waitingCallsCount = activeCalls.filter((call) => isWaitingStatus(call.status)).length;
  const answeredCallsCount = recentCalls.filter((call) => isAnsweredStatus(call.status)).length;
  const missedCallsCount =
    followUps.filter((task) => isMissedStatus(task.status) || task.status === "pending").length +
    missedLeads.filter((lead) => isMissedStatus(lead.status) || lead.status === "pending_follow_up" || lead.status === "open").length;

  const selectedCall =
    (input.selectedCallId ? activeCalls.find((call) => call.id === input.selectedCallId) || recentCalls.find((call) => call.id === input.selectedCallId) : null) ||
    (input.selectedPhone ? activeCalls.find((call) => call.callerNumber === input.selectedPhone) || recentCalls.find((call) => call.callerNumber === input.selectedPhone) : null) ||
    activeCalls[0] ||
    recentCalls[0] ||
    null;

  const selectedPhone = input.selectedPhone || selectedCall?.callerNumber || followUps[0]?.phone || missedLeads[0]?.phone || null;
  const selectedContext = selectedPhone ? serializeCustomerContextSummary(await getContextForPhone(selectedPhone)) : null;

  return {
    generatedAt: new Date().toISOString(),
    viewer: {
      actorUserId: viewer.actorUserId,
      actorRole: viewer.actorRole,
      actorEmail: viewer.actorEmail,
      targetUserId: viewer.targetUserId,
      targetRole: viewer.targetRole,
      targetAttendantCategory: viewer.targetAttendantCategory,
      isAdmin: viewer.isAdmin,
      impersonateId: viewer.impersonateId,
    },
    summary: viewer.isAdmin
      ? {
          callsToday: callsTodayCount,
          activeCalls: activeCallsCount,
          waitingCalls: waitingCallsCount,
          answeredCalls: answeredCallsCount,
          missedCalls: missedCallsCount,
          averageTalkTimeSeconds: Math.round(Number(avgTalkAggregate._avg.durationInSeconds ?? 0)),
          callCostToday: Number(callCostAggregate._sum.amount ?? 0),
          newVoiceLeads: newVoiceLeadsCount,
        }
      : {
          myCallsToday: callsTodayCount,
          myActiveCalls: activeCallsCount,
          myMissedCalls: missedCallsCount,
          myFollowUps: followUps.length + missedLeads.length,
          myAnsweredCalls: answeredCallsCount,
        },
    activeCalls,
    waitingCalls: activeCalls.filter((call) => isWaitingStatus(call.status)),
    callQueue: [...followUps, ...missedLeads].sort((left, right) => {
      const leftAt = new Date(left.dueAt || left.updatedAt).getTime();
      const rightAt = new Date(right.dueAt || right.updatedAt).getTime();
      return leftAt - rightAt;
    }),
    recentCalls,
    recentRecordings: recentCalls.filter((call) => Boolean(call.recordingUrl)).slice(0, 8),
    followUps,
    missedLeads,
    agents,
    selectedCallId: selectedCall?.id ?? null,
    selectedPhone,
    selectedContext,
  };
}

export async function listVoiceCallsSnapshot(input: VoiceLiveSnapshotInput) {
  const snapshot = await getVoiceLiveSnapshot(input);
  return {
    generatedAt: snapshot.generatedAt,
    activeCalls: snapshot.activeCalls,
    recentCalls: snapshot.recentCalls,
    waitingCalls: snapshot.waitingCalls,
  };
}

export type VoiceLiveSnapshot = Awaited<ReturnType<typeof getVoiceLiveSnapshot>>;
export type VoiceCallsSnapshot = Awaited<ReturnType<typeof listVoiceCallsSnapshot>>;

export async function updateVoicePresence(input: {
  userId: string;
  status: string;
  currentCallId?: string | null;
}) {
  const normalizedStatus = String(input.status || "").trim().toUpperCase();
  if (!VOICE_PRESENCE_STATUSES.includes(normalizedStatus as VoicePresenceStatus)) {
    throw new Error("invalid_presence_status");
  }

  return prisma.voiceAgentPresence.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      status: normalizedStatus,
      currentCallId: input.currentCallId ?? null,
      lastSeenAt: new Date(),
    },
    update: {
      status: normalizedStatus,
      currentCallId: input.currentCallId ?? null,
      lastSeenAt: new Date(),
    },
  });
}

export async function addVoiceCallNote(input: {
  voiceCallId: string;
  authorId: string;
  note: string;
}) {
  const trimmedNote = input.note.trim();
  if (!trimmedNote) throw new Error("note_required");

  const call = await prisma.voiceCall.findUnique({
    where: { id: input.voiceCallId },
    select: {
      id: true,
      customerId: true,
    },
  });

  if (!call) throw new Error("voice_call_not_found");

  return prisma.voiceCallNote.create({
    data: {
      voiceCallId: call.id,
      customerId: call.customerId,
      authorId: input.authorId,
      note: trimmedNote,
    },
  });
}

export async function saveVoiceFollowUp(input: {
  id?: string | null;
  voiceCallId?: string | null;
  voiceLeadId?: string | null;
  customerId?: string | null;
  assignedToId?: string | null;
  phone?: string | null;
  title?: string | null;
  status?: string | null;
  dueAt?: string | null;
  notes?: string | null;
}) {
  const normalizedStatus = String(input.status || "pending").trim().toLowerCase();
  if (!["pending", "contacted", "resolved", "closed"].includes(normalizedStatus)) {
    throw new Error("invalid_follow_up_status");
  }

  const normalizedDueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (normalizedDueAt && Number.isNaN(normalizedDueAt.getTime())) {
    throw new Error("invalid_due_at");
  }

  if (input.id) {
    return prisma.voiceFollowUp.update({
      where: { id: input.id },
      data: {
        title: input.title?.trim() || undefined,
        status: normalizedStatus,
        dueAt: normalizedDueAt ?? undefined,
        notes: input.notes?.trim() || undefined,
        assignedToId: input.assignedToId ?? undefined,
      },
    });
  }

  let phone = String(input.phone || "").trim();
  let customerId = input.customerId ?? null;

  if (input.voiceCallId) {
    const call = await prisma.voiceCall.findUnique({
      where: { id: input.voiceCallId },
      select: {
        callerNumber: true,
        customerId: true,
        assignedToId: true,
      },
    });
    if (!call) throw new Error("voice_call_not_found");
    if (!phone) phone = call.callerNumber;
    if (!customerId) customerId = call.customerId;
    if (!input.assignedToId && call.assignedToId) {
      input.assignedToId = call.assignedToId;
    }
  }

  if (input.voiceLeadId && !phone) {
    const lead = await prisma.voiceLead.findUnique({
      where: { id: input.voiceLeadId },
      select: { phone: true, customerId: true, assignedToId: true },
    });
    if (!lead) throw new Error("voice_lead_not_found");
    phone = lead.phone;
    if (!customerId) customerId = lead.customerId;
    if (!input.assignedToId && lead.assignedToId) {
      input.assignedToId = lead.assignedToId;
    }
  }

  if (!phone) throw new Error("phone_required");
  if (!input.title?.trim()) throw new Error("title_required");

  return prisma.voiceFollowUp.create({
    data: {
      voiceCallId: input.voiceCallId ?? null,
      voiceLeadId: input.voiceLeadId ?? null,
      customerId,
      assignedToId: input.assignedToId ?? null,
      phone,
      title: input.title.trim(),
      status: normalizedStatus,
      dueAt: normalizedDueAt,
      notes: input.notes?.trim() || null,
    },
  });
}
