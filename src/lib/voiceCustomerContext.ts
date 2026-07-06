import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import {
  ensureQuoteRequestsSchema,
  serializeQuoteRequest,
  type SerializedQuoteRequest,
} from "@/lib/quoteRequests";
import {
  isOpenQuotationStatus,
  isPendingPodStatus,
  isPendingWebOrderStatus,
} from "@/lib/operationsWorkQueue";
import {
  buildChatraceLookupBaseResult,
  lookupChatraceContactByPhone,
  type ChatraceLookupResult,
} from "@/lib/integrations/chatrace";

type VoiceBasicUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  county: string | null;
  town: string | null;
  locationNotes: string | null;
};

type QuoteRequestRow = {
  id: string;
  quoteRef: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerLocation: string | null;
  county: string | null;
  town: string | null;
  specificLocation: string | null;
  projectType: string | null;
  propertyType: string | null;
  preferredContactMethod: string | null;
  bestTimeToContact: string | null;
  urgency: string | null;
  installationStatus: string | null;
  loadDescription: string | null;
  budgetRange: string | null;
  preferredProducts: string | null;
  notes: string | null;
  answersJson: Prisma.JsonValue | null;
  status: string;
  source: string | null;
  assignedAttendantId: string | null;
  assignedAttendantEmail: string | null;
  assignedAttendantName: string | null;
  templateId: string | null;
  templateName: string | null;
  requiresApproval: boolean | null;
  approvedAt: Date | string | null;
  approvedById: string | null;
  approvedByName: string | null;
  submittedForApprovalAt: Date | string | null;
  submittedForApprovalById: string | null;
  versionNumber: number | null;
  parentQuoteRequestId: string | null;
  validUntil: Date | string | null;
  viewedAt: Date | string | null;
  customerActionAt: Date | string | null;
  manualCustomerName: string | null;
  manualCustomerPhone: string | null;
  manualCustomerEmail: string | null;
  approvalReason: string | null;
  quoteTitle: string | null;
  quoteMessage: string | null;
  quotationData: Prisma.JsonValue | null;
  responseMetadata: Prisma.JsonValue | null;
  respondedAt: Date | string | null;
  respondedById: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type VoiceReceiptContext = {
  id: string;
  receiptNumber: string | null;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: Date;
  issuedAt: Date;
  issuedByName: string | null;
  issuedByEmail: string | null;
  isPod: boolean;
  podStatus: string | null;
};

export type VoiceWebsiteOrderContext = {
  id: string;
  orderRef: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerLocation: string;
  total: number;
  status: string;
  orderType: string;
  createdAt: Date;
  receiptId: string | null;
  confirmedByName: string | null;
  confirmedByEmail: string | null;
};

export type VoiceAgentOrderContext = {
  id: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  productName: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  receiptId: string | null;
  agentId: string;
  agentName: string | null;
  agentEmail: string | null;
  customerNotes: string | null;
  internalAgentNotes: string | null;
};

export type VoiceLeadContext = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  assignedToName: string | null;
  assignedToEmail: string | null;
  lastCallAt: Date | null;
  createdAt: Date;
};

export type VoiceCallNoteContext = {
  id: string;
  note: string;
  createdAt: Date;
  authorName: string | null;
  authorEmail: string | null;
  voiceCallId: string;
};

export type VoiceTaskFollowUpContext = {
  id: string;
  phone: string;
  title: string;
  status: string;
  dueAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedToName: string | null;
  assignedToEmail: string | null;
  voiceCallId: string | null;
  voiceLeadId: string | null;
};

export type VoiceRecentCallContext = {
  id: string;
  sessionId: string;
  status: string;
  routedTo: string | null;
  startedAt: Date | null;
  createdAt: Date;
  assignedToName: string | null;
  assignedToEmail: string | null;
  durationInSeconds: number | null;
};

export type VoiceTimelineItem = {
  id: string;
  type: "CALL" | "RECEIPT" | "WEB_ORDER" | "QUOTATION" | "AGENT_ORDER" | "POD" | "FOLLOW_UP" | "NOTE" | "TASK";
  title: string;
  detail: string;
  at: Date;
  href: string | null;
};

export type VoiceCustomerContext = {
  normalizedPhone: string;
  phoneVariants: string[];
  chatrace: ChatraceLookupResult;
  matchedCustomer: VoiceBasicUser | null;
  recentReceipts: VoiceReceiptContext[];
  recentWebOrders: VoiceWebsiteOrderContext[];
  recentQuotations: SerializedQuoteRequest[];
  recentAgentOrders: VoiceAgentOrderContext[];
  pendingPodReceipts: VoiceReceiptContext[];
  recentCalls: VoiceRecentCallContext[];
  followUps: VoiceLeadContext[];
  recentNotes: VoiceCallNoteContext[];
  taskFollowUps: VoiceTaskFollowUpContext[];
  notes: string[];
  assignedAgent: {
    id: string | null;
    name: string | null;
    email: string | null;
    source: "AGENT_ORDER" | "QUOTATION" | "VOICE_ASSIGNMENT" | null;
  } | null;
  summary: {
    customerName: string | null;
    email: string | null;
    location: string | null;
    lastPurchaseAt: Date | null;
    totalPurchasesValue: number;
    openQuotations: number;
    pendingWebOrders: number;
    pendingPod: number;
  };
  timeline: VoiceTimelineItem[];
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function buildCustomerLocation(user: VoiceBasicUser | null) {
  if (!user) return null;
  return uniqueStrings([user.town, user.county, user.locationNotes]).join(", ") || null;
}

async function findUserById(userId: string | null | undefined) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsappNumber: true,
      county: true,
      town: true,
      locationNotes: true,
    },
  });
}

export async function resolveVoiceCustomerLinkByPhone(rawPhone: string | null | undefined) {
  const normalizedPhone = normalizeKenyanPhone(rawPhone ?? "");
  const phoneVariants = getKenyanPhoneVariants(normalizedPhone);

  if (!normalizedPhone || !phoneVariants.length) {
    return {
      normalizedPhone,
      phoneVariants: [],
      matchedCustomer: null,
    };
  }

  const directUser = await prisma.user.findFirst({
    where: {
      OR: [{ phone: { in: phoneVariants } }, { whatsappNumber: { in: phoneVariants } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsappNumber: true,
      county: true,
      town: true,
      locationNotes: true,
    },
  });

  if (directUser) {
    return { normalizedPhone, phoneVariants, matchedCustomer: directUser };
  }

  const websiteOrder = await prisma.websiteOrder.findFirst({
    where: {
      customerPhone: { in: phoneVariants },
      customerUserId: { not: null },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { customerUserId: true },
  });
  const websiteUser = await findUserById(websiteOrder?.customerUserId);
  if (websiteUser) {
    return { normalizedPhone, phoneVariants, matchedCustomer: websiteUser };
  }

  const agentSale = await prisma.agentSale.findFirst({
    where: {
      customerPhone: { in: phoneVariants },
      customerUserId: { not: null },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { customerUserId: true },
  });
  const agentCustomer = await findUserById(agentSale?.customerUserId);
  if (agentCustomer) {
    return { normalizedPhone, phoneVariants, matchedCustomer: agentCustomer };
  }

  await ensureQuoteRequestsSchema();
  const quoteRows = await prisma.$queryRaw<Array<{ customerUserId: string | null }>>(Prisma.sql`
    SELECT "customerUserId"
    FROM "QuoteRequest"
    WHERE "customerPhone" IN (${Prisma.join(phoneVariants)})
      AND "customerUserId" IS NOT NULL
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `);
  const quoteCustomer = await findUserById(quoteRows[0]?.customerUserId);

  return {
    normalizedPhone,
    phoneVariants,
    matchedCustomer: quoteCustomer,
  };
}

async function listVoiceQuoteRequests(input: {
  customerUserId?: string | null;
  phoneVariants: string[];
  normalizedEmails: string[];
  take?: number;
}) {
  await ensureQuoteRequestsSchema();
  const take = Math.max(1, Math.min(10, Number(input.take ?? 5)));
  const conditions: Prisma.Sql[] = [];

  if (input.customerUserId) {
    conditions.push(Prisma.sql`"customerUserId" = ${input.customerUserId}`);
  }
  if (input.phoneVariants.length) {
    conditions.push(Prisma.sql`"customerPhone" IN (${Prisma.join(input.phoneVariants)})`);
  }
  if (input.normalizedEmails.length) {
    conditions.push(
      Prisma.sql`LOWER(COALESCE("customerEmail", '')) IN (${Prisma.join(input.normalizedEmails)})`,
    );
  }

  if (!conditions.length) return [] as SerializedQuoteRequest[];

  const rows = await prisma.$queryRaw<QuoteRequestRow[]>(Prisma.sql`
    SELECT *
    FROM "QuoteRequest"
    WHERE (${Prisma.join(conditions, " OR ")})
    ORDER BY "updatedAt" DESC, "createdAt" DESC
    LIMIT ${take}
  `);

  return rows.map(serializeQuoteRequest);
}

export async function getVoiceCustomerContext(
  rawPhone: string | null | undefined,
  options?: { take?: number; includeChatrace?: boolean },
) {
  const take = Math.max(1, Math.min(10, Number(options?.take ?? 5)));
  const includeChatrace = options?.includeChatrace !== false;
  const link = await resolveVoiceCustomerLinkByPhone(rawPhone);
  const normalizedEmails = uniqueStrings([
    link.matchedCustomer?.email ? normalizeEmail(link.matchedCustomer.email) : "",
  ]);

  if (!link.phoneVariants.length && !link.matchedCustomer) {
    return {
      normalizedPhone: link.normalizedPhone,
      phoneVariants: [],
      chatrace: includeChatrace
        ? await lookupChatraceContactByPhone(link.normalizedPhone)
        : buildChatraceLookupBaseResult(link.normalizedPhone),
      matchedCustomer: null,
      recentReceipts: [],
      recentWebOrders: [],
      recentQuotations: [],
      recentAgentOrders: [],
      pendingPodReceipts: [],
      recentCalls: [],
      followUps: [],
      recentNotes: [],
      taskFollowUps: [],
      notes: [],
      assignedAgent: null,
      summary: {
        customerName: null,
        email: null,
        location: null,
        lastPurchaseAt: null,
        totalPurchasesValue: 0,
        openQuotations: 0,
        pendingWebOrders: 0,
        pendingPod: 0,
      },
      timeline: [],
    } satisfies VoiceCustomerContext;
  }

  const [
    receiptRows,
    webOrderRows,
    agentSaleRows,
    quoteRows,
    voiceCallRows,
    voiceLeadRows,
    voiceNoteRows,
    voiceTaskRows,
    chatrace,
  ] =
    await Promise.all([
      prisma.receipt.findMany({
        where: {
          order: {
            customerPhone: { in: link.phoneVariants },
          },
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              totalAmount: true,
              paymentStatus: true,
              status: true,
              createdAt: true,
            },
          },
          issuedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ generatedAt: "desc" }],
        take,
      }),
      prisma.websiteOrder.findMany({
        where: {
          OR: [
            { customerPhone: { in: link.phoneVariants } },
            ...(link.matchedCustomer?.id ? [{ customerUserId: link.matchedCustomer.id }] : []),
          ],
        },
        include: {
          confirmedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take,
      }),
      prisma.agentSale.findMany({
        where: {
          OR: [
            { customerPhone: { in: link.phoneVariants } },
            ...(link.matchedCustomer?.id ? [{ customerUserId: link.matchedCustomer.id }] : []),
          ],
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take,
      }),
      listVoiceQuoteRequests({
        customerUserId: link.matchedCustomer?.id ?? null,
        phoneVariants: link.phoneVariants,
        normalizedEmails,
        take,
      }),
      prisma.voiceCall.findMany({
        where: {
          OR: [
            { callerNumber: { in: link.phoneVariants } },
            ...(link.matchedCustomer?.id ? [{ customerId: link.matchedCustomer.id }] : []),
          ],
        },
        include: {
          assignedTo: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take,
      }),
      prisma.voiceLead.findMany({
        where: {
          OR: [
            { phone: { in: link.phoneVariants } },
            ...(link.matchedCustomer?.id ? [{ customerId: link.matchedCustomer.id }] : []),
          ],
        },
        include: {
          assignedTo: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take,
      }),
      prisma.voiceCallNote.findMany({
        where: {
          OR: [
            ...(link.matchedCustomer?.id ? [{ customerId: link.matchedCustomer.id }] : []),
            { voiceCall: { callerNumber: { in: link.phoneVariants } } },
          ],
        },
        include: {
          author: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take,
      }),
      prisma.voiceFollowUp.findMany({
        where: {
          OR: [
            { phone: { in: link.phoneVariants } },
            ...(link.matchedCustomer?.id ? [{ customerId: link.matchedCustomer.id }] : []),
          ],
        },
        include: {
          assignedTo: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take,
      }),
      includeChatrace
        ? lookupChatraceContactByPhone(link.normalizedPhone)
        : Promise.resolve(buildChatraceLookupBaseResult(link.normalizedPhone)),
    ]);

  const recentReceipts: VoiceReceiptContext[] = receiptRows.map((receipt) => {
    const podData =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? ((receipt.data as Record<string, unknown>).podDelivery as Record<string, unknown> | undefined)
        : undefined;

    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      orderId: receipt.order.id,
      orderNumber: receipt.order.orderNumber,
      customerName: receipt.order.customerName,
      customerPhone: receipt.order.customerPhone,
      customerEmail: receipt.order.customerEmail,
      totalAmount: toNumber(receipt.order.totalAmount),
      paymentStatus: String(receipt.order.paymentStatus),
      orderStatus: String(receipt.order.status),
      createdAt: receipt.order.createdAt,
      issuedAt: receipt.generatedAt,
      issuedByName: receipt.issuedBy?.name ?? null,
      issuedByEmail: receipt.issuedBy?.email ?? null,
      isPod: Boolean(podData),
      podStatus: podData?.status ? String(podData.status) : null,
    };
  });

  const recentWebOrders: VoiceWebsiteOrderContext[] = webOrderRows.map((order) => ({
    id: order.id,
    orderRef: order.orderRef,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    customerLocation: order.customerLocation,
    total: Number(order.total),
    status: String(order.status),
    orderType: String(order.orderType),
    createdAt: order.createdAt,
    receiptId: order.receiptId,
    confirmedByName: order.confirmedBy?.name ?? null,
    confirmedByEmail: order.confirmedBy?.email ?? null,
  }));

  const recentAgentOrders: VoiceAgentOrderContext[] = agentSaleRows.map((sale) => ({
    id: sale.id,
    customerUserId: sale.customerUserId,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerLocation: sale.customerLocation,
    productName: sale.productName,
    totalAmount: Number(sale.totalAmount),
    status: sale.status,
    createdAt: sale.createdAt,
    receiptId: sale.receiptId,
    agentId: sale.agent.id,
    agentName: sale.agent.name ?? null,
    agentEmail: sale.agent.email ?? null,
    customerNotes: sale.customerNotes,
    internalAgentNotes: sale.internalAgentNotes,
  }));

  const pendingPodReceipts = recentReceipts.filter((receipt) => isPendingPodStatus(receipt.podStatus));

  const recentCalls: VoiceRecentCallContext[] = voiceCallRows.map((call) => ({
    id: call.id,
    sessionId: call.sessionId,
    status: call.status,
    routedTo: call.routedTo,
    startedAt: call.startedAt,
    createdAt: call.createdAt,
    assignedToName: call.assignedTo?.name ?? null,
    assignedToEmail: call.assignedTo?.email ?? null,
    durationInSeconds: call.durationInSeconds,
  }));

  const followUps: VoiceLeadContext[] = voiceLeadRows.map((lead) => ({
    id: lead.id,
    phone: lead.phone,
    name: lead.name,
    status: lead.status,
    assignedToName: lead.assignedTo?.name ?? null,
    assignedToEmail: lead.assignedTo?.email ?? null,
    lastCallAt: lead.lastCallAt,
    createdAt: lead.createdAt,
  }));

  const recentNotes: VoiceCallNoteContext[] = voiceNoteRows.map((note) => ({
    id: note.id,
    note: note.note,
    createdAt: note.createdAt,
    authorName: note.author?.name ?? null,
    authorEmail: note.author?.email ?? null,
    voiceCallId: note.voiceCallId,
  }));

  const taskFollowUps: VoiceTaskFollowUpContext[] = voiceTaskRows.map((task) => ({
    id: task.id,
    phone: task.phone,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt,
    notes: task.notes,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignedToName: task.assignedTo?.name ?? null,
    assignedToEmail: task.assignedTo?.email ?? null,
    voiceCallId: task.voiceCallId,
    voiceLeadId: task.voiceLeadId,
  }));

  const notes = uniqueStrings([
    ...recentAgentOrders.flatMap((sale) => [sale.customerNotes, sale.internalAgentNotes]),
    ...recentWebOrders.map((order) => order.customerLocation || order.customerEmail || null),
    ...quoteRows.flatMap((quote) => [quote.notes, quote.quoteMessage]),
    ...followUps.map((lead) => lead.name),
    ...recentNotes.map((note) => note.note),
    ...taskFollowUps.flatMap((task) => [task.title, task.notes]),
  ]).slice(0, 8);

  const assignedAgent =
    (recentAgentOrders[0]
      ? {
          id: recentAgentOrders[0].agentId,
          name: recentAgentOrders[0].agentName,
          email: recentAgentOrders[0].agentEmail,
          source: "AGENT_ORDER" as const,
        }
      : null) ||
    (quoteRows[0]?.assignedAttendant
      ? {
          id: quoteRows[0].assignedAttendant.id,
          name: quoteRows[0].assignedAttendant.name,
          email: quoteRows[0].assignedAttendant.email,
          source: "QUOTATION" as const,
        }
      : null) ||
    (recentCalls[0]?.assignedToName || recentCalls[0]?.assignedToEmail
      ? {
          id: null,
          name: recentCalls[0].assignedToName,
          email: recentCalls[0].assignedToEmail,
          source: "VOICE_ASSIGNMENT" as const,
        }
      : null);

  const receiptTotal = recentReceipts.reduce((sum, receipt) => sum + receipt.totalAmount, 0);
  const websiteTotal = recentWebOrders
    .filter((order) => !order.receiptId)
    .reduce((sum, order) => sum + order.total, 0);
  const agentTotal = recentAgentOrders
    .filter((sale) => !sale.receiptId)
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  const purchaseDates = [
    ...recentReceipts.map((receipt) => receipt.issuedAt),
    ...recentWebOrders.map((order) => order.createdAt),
    ...recentAgentOrders.map((sale) => sale.createdAt),
  ].filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  const timeline: VoiceTimelineItem[] = [
    ...recentCalls.map((call) => ({
      id: `call-${call.id}`,
      type: "CALL" as const,
      title: `Call ${call.status.replace(/_/g, " ")}`,
      detail: call.routedTo || "No route recorded",
      at: call.startedAt ?? call.createdAt,
      href: "/admin/communications/voice",
    })),
    ...recentReceipts.map((receipt) => ({
      id: `receipt-${receipt.id}`,
      type: receipt.isPod ? ("POD" as const) : ("RECEIPT" as const),
      title: receipt.isPod ? "POD receipt" : "POS receipt",
      detail: `${receipt.receiptNumber || receipt.orderNumber} · KES ${receipt.totalAmount.toLocaleString("en-KE")}`,
      at: receipt.issuedAt,
      href: `/marketing/receipts?tab=pos&receiptId=${encodeURIComponent(receipt.id)}`,
    })),
    ...recentWebOrders.map((order) => ({
      id: `web-${order.id}`,
      type: "WEB_ORDER" as const,
      title: "Website order",
      detail: `${order.orderRef} · ${order.status.replace(/_/g, " ")}`,
      at: order.createdAt,
      href: "/marketing/receipts?tab=web-orders",
    })),
    ...quoteRows.map((quote) => ({
      id: `quote-${quote.id}`,
      type: "QUOTATION" as const,
      title: "Quotation request",
      detail: `${quote.quoteRef} · ${quote.status.replace(/_/g, " ")}`,
      at: new Date(quote.updatedAt || quote.createdAt),
      href: `/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(quote.id)}`,
    })),
    ...recentAgentOrders.map((sale) => ({
      id: `agent-${sale.id}`,
      type: "AGENT_ORDER" as const,
      title: "Agent order",
      detail: `${sale.productName} · ${sale.status.replace(/_/g, " ")}`,
      at: sale.createdAt,
      href: `/marketing/agent-orders?saleId=${encodeURIComponent(sale.id)}`,
    })),
    ...followUps.map((lead) => ({
      id: `lead-${lead.id}`,
      type: "FOLLOW_UP" as const,
      title: "Voice follow-up",
      detail: lead.status.replace(/_/g, " "),
      at: lead.lastCallAt ?? lead.createdAt,
      href: "/admin/communications/voice",
    })),
    ...recentNotes.map((note) => ({
      id: `note-${note.id}`,
      type: "NOTE" as const,
      title: `Call note${note.authorName ? ` · ${note.authorName}` : ""}`,
      detail: note.note,
      at: note.createdAt,
      href: "/admin/communications/voice",
    })),
    ...taskFollowUps.map((task) => ({
      id: `task-${task.id}`,
      type: "TASK" as const,
      title: task.title,
      detail: task.status.replace(/_/g, " "),
      at: task.updatedAt,
      href: "/admin/communications/voice",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return {
    normalizedPhone: link.normalizedPhone,
    phoneVariants: link.phoneVariants,
    chatrace,
    matchedCustomer: link.matchedCustomer,
    recentReceipts,
    recentWebOrders,
    recentQuotations: quoteRows,
    recentAgentOrders,
    pendingPodReceipts,
    recentCalls,
    followUps,
    recentNotes,
    taskFollowUps,
    notes,
    assignedAgent,
    summary: {
      customerName:
        link.matchedCustomer?.name ??
        recentReceipts[0]?.customerName ??
        recentWebOrders[0]?.customerName ??
        recentAgentOrders[0]?.customerName ??
        quoteRows[0]?.customerName ??
        null,
      email:
        link.matchedCustomer?.email ??
        recentReceipts[0]?.customerEmail ??
        recentWebOrders[0]?.customerEmail ??
        quoteRows[0]?.customerEmail ??
        null,
      location:
        buildCustomerLocation(link.matchedCustomer) ??
        recentWebOrders[0]?.customerLocation ??
        recentAgentOrders[0]?.customerLocation ??
        quoteRows[0]?.customerLocation ??
        null,
      lastPurchaseAt: purchaseDates.length
        ? purchaseDates.sort((a, b) => b.getTime() - a.getTime())[0]
        : null,
      totalPurchasesValue: receiptTotal + websiteTotal + agentTotal,
      openQuotations: quoteRows.filter((quote) => isOpenQuotationStatus(quote.status)).length,
      pendingWebOrders: recentWebOrders.filter((order) => isPendingWebOrderStatus(order.status)).length,
      pendingPod: pendingPodReceipts.length,
    },
    timeline,
  } satisfies VoiceCustomerContext;
}
