import { prisma } from "@/lib/prisma";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { getVoiceCustomerContext, type VoiceTimelineItem } from "@/lib/voiceCustomerContext";
import { resolveVoiceProviderOutcome } from "@/lib/voiceOperations";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import type { ChatraceLookupResult } from "@/lib/integrations/chatrace";

export type AdminCustomerContextInput = {
  customerUserId?: string | null;
  displayName?: string | null;
  phones?: string[];
  emails?: string[];
};

export type AdminCustomerContextTimelineItem = {
  id: string;
  title: string;
  detail: string;
  at: string;
  href: string | null;
  tone: "voice" | "sales" | "account" | "support" | "chatrace";
};

export type AdminCustomerContextResponse = {
  profile: {
    displayName: string;
    accountUserId: string | null;
    phones: string[];
    emails: string[];
    location: string | null;
    county: string | null;
    town: string | null;
    estateLandmark: string | null;
    locationNotes: string | null;
    customerSince: string | null;
  };
  account: {
    exists: boolean;
    lastLoginMethod: string | null;
    phoneVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    hasPortalAccess: boolean;
    createdAt: string | null;
  };
  voice: {
    totalCalls: number;
    answeredCalls: number;
    missedCalls: number;
    attemptedCalls: number;
    openFollowUps: number;
    callbackRequests: number;
    requestedCallbacks: number;
    lastCallAt: string | null;
    lastCallStatus: string | null;
    lastCallStatusLabel: string | null;
    lastCallId: string | null;
    lastCallDirection: string | null;
    lastCallAgent: string | null;
    latestAssignedAgent: string | null;
    lastRequestedCallbackAt: string | null;
    lastRequestedCallbackBy: string | null;
  };
  sales: {
    totalPurchasesValue: number;
    openQuotations: number;
    pendingWebOrders: number;
    pendingPod: number;
    lastPurchaseAt: string | null;
    lastReceipt: {
      id: string;
      receiptNumber: string | null;
      orderNumber: string;
      totalAmount: number;
      issuedAt: string;
    } | null;
    lastWebOrder: {
      id: string;
      orderRef: string;
      total: number;
      status: string;
      createdAt: string;
    } | null;
    lastQuotation: {
      id: string;
      quoteRef: string;
      status: string;
      updatedAt: string;
    } | null;
    lastAgentOrder: {
      id: string;
      productName: string;
      totalAmount: number;
      status: string;
      createdAt: string;
    } | null;
  };
  chatrace: {
    found: boolean;
    lastInteractionAt: string | null;
    tags: string[];
    inboxUrl: string | null;
    channel: string | null;
    sourceError: boolean;
  };
  quickLinks: {
    voiceHistoryHref: string | null;
    lastCallHref: string | null;
    receiptDeskHref: string | null;
    lastReceiptHref: string | null;
    quotationHref: string | null;
    webOrdersHref: string | null;
    chatraceInboxHref: string | null;
  };
  timeline: AdminCustomerContextTimelineItem[];
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{10,13}$/.test(trimmed)) {
    const num = Number(trimmed);
    const ms = trimmed.length === 10 ? num * 1000 : num;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStatusLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.replace(/_/g, " ");
}

function formatLoginMethod(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "africastalking_otp") return "Phone OTP";
  if (normalized === "email_otp") return "Email OTP";
  return value ?? null;
}

function buildLocation(parts: Array<string | null | undefined>) {
  return uniqueStrings(parts).join(", ") || null;
}

function buildVoiceHref(args: {
  selectedPhone?: string | null;
  selectedCallId?: string | null;
  tab?: "operations" | "recent" | "followups";
}) {
  const params = new URLSearchParams();
  if (args.tab) params.set("tab", args.tab);
  if (args.selectedPhone) params.set("selectedPhone", args.selectedPhone);
  if (args.selectedCallId) params.set("selectedCallId", args.selectedCallId);
  return `/admin/communications/voice${params.toString() ? `?${params.toString()}` : ""}`;
}

function buildReceiptDeskHref(receiptId: string | null | undefined) {
  const params = new URLSearchParams();
  params.set("tab", "pos");
  if (receiptId) params.set("receiptId", receiptId);
  return `/marketing/receipts?${params.toString()}`;
}

function buildWebOrdersHref(orderId: string | null | undefined) {
  const params = new URLSearchParams();
  params.set("tab", "web-orders");
  if (orderId) params.set("orderId", orderId);
  return `/marketing/receipts?${params.toString()}`;
}

function buildQuotationHref(quoteId: string | null | undefined) {
  const params = new URLSearchParams();
  params.set("tab", "quotations");
  if (quoteId) params.set("quoteId", quoteId);
  return `/marketing/receipts?${params.toString()}`;
}

function mapVoiceTimelineTone(type: VoiceTimelineItem["type"]): AdminCustomerContextTimelineItem["tone"] {
  if (type === "CALL") return "voice";
  if (type === "FOLLOW_UP" || type === "TASK" || type === "NOTE") return "support";
  return "sales";
}

function mapChatrace(input: ChatraceLookupResult) {
  return {
    found: Boolean(input.found),
    lastInteractionAt: toIso(input.lastInteractionAt),
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
    inboxUrl: input.inboxUrl ?? null,
    channel: input.channel ?? null,
    sourceError: Boolean(input.sourceError),
  };
}

export async function getAdminCustomerContext(
  input: AdminCustomerContextInput,
): Promise<AdminCustomerContextResponse> {
  const normalizedPhones = Array.from(
    new Set(
      (input.phones || [])
        .flatMap((phone) => {
          const normalized = normalizeKenyanPhone(phone || "");
          return normalized ? getKenyanPhoneVariants(normalized) : [];
        })
        .filter(Boolean),
    ),
  );
  const normalizedEmails = uniqueStrings(input.emails).map((email) => email.toLowerCase());

  const basePhone = normalizedPhones[0] ?? null;
  const voiceContext = basePhone
    ? await getVoiceCustomerContext(basePhone, { take: 8, includeChatrace: true })
    : null;

  const resolvedUserId =
    String(input.customerUserId || "").trim() ||
    voiceContext?.matchedCustomer?.id ||
    "";

  const accountProfile = resolvedUserId
    ? await findSafeCustomerProfileByUserId(resolvedUserId)
    : null;

  const fullUser = accountProfile?.id
    ? await prisma.user.findUnique({
        where: { id: accountProfile.id },
        select: {
          id: true,
          email: true,
          phone: true,
          whatsappNumber: true,
          county: true,
          town: true,
          estateLandmark: true,
          locationNotes: true,
          createdAt: true,
          phoneVerifiedAt: true,
          emailVerifiedAt: true,
          lastLoginMethod: true,
        },
      })
    : null;

  const phoneWhere = normalizedPhones.length
    ? [
        { callerNumber: { in: normalizedPhones } },
        { destinationNumber: { in: normalizedPhones } },
      ]
    : [];
  const userWhere = resolvedUserId ? [{ customerId: resolvedUserId }] : [];

  const voiceCallRows =
    phoneWhere.length || userWhere.length
      ? await prisma.voiceCall.findMany({
          where: {
            OR: [...phoneWhere, ...userWhere],
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
        })
      : [];

  const callbackRequests =
    normalizedPhones.length || userWhere.length
      ? await prisma.voiceCallbackRequest.findMany({
          where: {
            OR: [
              ...(normalizedPhones.length ? [{ normalizedPhone: { in: normalizedPhones } }] : []),
              ...(voiceCallRows.length ? [{ voiceCallId: { in: voiceCallRows.map((call) => call.id) } }] : []),
            ],
          },
          include: {
            agent: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }],
        })
      : [];

  const voiceCallStatuses = voiceCallRows.map((call) => {
    const outcome = resolveVoiceProviderOutcome(call);
    return {
      call,
      displayStatus: String(outcome.displayStatus || "").trim().toLowerCase(),
      providerStatus: String(outcome.providerStatus || "").trim().toLowerCase(),
    };
  });

  const answeredCalls = voiceCallStatuses.filter((entry) =>
    ["answered", "connected", "transferred"].includes(entry.displayStatus),
  );
  const missedCalls = voiceCallStatuses.filter((entry) =>
    ["missed", "no_answer", "busy", "failed", "aborted", "cancelled", "disconnected"].includes(entry.displayStatus),
  );
  const attemptedCalls = voiceCallStatuses.filter((entry) => entry.displayStatus === "attempted_call");

  const latestCall = voiceCallStatuses[0] ?? null;
  const latestRequestedCallback = callbackRequests.find((request) => request.requestedAt) ?? null;

  const profilePhones = uniqueStrings([
    ...normalizedPhones,
    fullUser?.phone,
    fullUser?.whatsappNumber,
    voiceContext?.matchedCustomer?.phone,
    voiceContext?.matchedCustomer?.whatsappNumber,
  ]);
  const profileEmails = uniqueStrings([
    ...normalizedEmails,
    fullUser?.email,
    voiceContext?.matchedCustomer?.email,
  ]);

  const customerSinceCandidates = [
    fullUser?.createdAt,
    voiceContext?.summary.lastPurchaseAt ?? null,
    latestCall?.call.createdAt ?? null,
  ]
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  const latestReceipt = voiceContext?.recentReceipts[0] ?? null;
  const latestWebOrder = voiceContext?.recentWebOrders[0] ?? null;
  const latestQuotation = voiceContext?.recentQuotations[0] ?? null;
  const latestAgentOrder = voiceContext?.recentAgentOrders[0] ?? null;

  const timeline: AdminCustomerContextTimelineItem[] = [
    ...(voiceContext?.timeline || []).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      at: item.at.toISOString(),
      href: item.href,
      tone: mapVoiceTimelineTone(item.type),
    })),
    ...(fullUser?.createdAt
      ? [
          {
            id: `account-created-${fullUser.id}`,
            title: "Customer account created",
            detail: "Portal account linked to this customer",
            at: fullUser.createdAt.toISOString(),
            href: null,
            tone: "account" as const,
          },
        ]
      : []),
    ...(fullUser?.phoneVerifiedAt
      ? [
          {
            id: `phone-verified-${fullUser.id}`,
            title: "Phone verified",
            detail: "Customer completed phone verification",
            at: fullUser.phoneVerifiedAt.toISOString(),
            href: null,
            tone: "account" as const,
          },
        ]
      : []),
    ...(fullUser?.emailVerifiedAt
      ? [
          {
            id: `email-verified-${fullUser.id}`,
            title: "Email verified",
            detail: "Customer completed email verification",
            at: fullUser.emailVerifiedAt.toISOString(),
            href: null,
            tone: "account" as const,
          },
        ]
      : []),
    ...(latestRequestedCallback?.requestedAt
      ? [
          {
            id: `callback-request-${latestRequestedCallback.id}`,
            title: "Requested callback",
            detail: "Customer clicked the callback request link after an unsuccessful call.",
            at: latestRequestedCallback.requestedAt.toISOString(),
            href: buildVoiceHref({
              selectedPhone: latestRequestedCallback.normalizedPhone,
              selectedCallId: latestRequestedCallback.voiceCallId ?? null,
              tab: "followups",
            }),
            tone: "support" as const,
          },
        ]
      : []),
    ...(voiceContext?.chatrace.found && voiceContext.chatrace.lastInteractionAt
      ? [
          {
            id: `chatrace-${voiceContext.chatrace.normalizedPhone}`,
            title: "Chatrace interaction",
            detail: "Customer has a recorded Chatrace conversation.",
            at: toIso(voiceContext.chatrace.lastInteractionAt) || new Date().toISOString(),
            href: voiceContext.chatrace.inboxUrl ?? null,
            tone: "chatrace" as const,
          },
        ]
      : []),
  ]
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 14);

  return {
    profile: {
      displayName:
        String(input.displayName || "").trim() ||
        accountProfile?.name ||
        voiceContext?.summary.customerName ||
        "Unnamed customer",
      accountUserId: (accountProfile?.id ?? resolvedUserId) || null,
      phones: profilePhones,
      emails: profileEmails,
      location: buildLocation([
        voiceContext?.summary.location,
        fullUser?.town,
        fullUser?.county,
        fullUser?.estateLandmark,
        fullUser?.locationNotes,
      ]),
      county: fullUser?.county ?? null,
      town: fullUser?.town ?? null,
      estateLandmark: fullUser?.estateLandmark ?? null,
      locationNotes: fullUser?.locationNotes ?? null,
      customerSince: customerSinceCandidates[0]?.toISOString() ?? null,
    },
    account: {
      exists: Boolean(fullUser?.id || accountProfile?.id),
      lastLoginMethod: formatLoginMethod(fullUser?.lastLoginMethod),
      phoneVerifiedAt: toIso(fullUser?.phoneVerifiedAt),
      emailVerifiedAt: toIso(fullUser?.emailVerifiedAt),
      hasPortalAccess: Boolean(fullUser?.id && (fullUser.phoneVerifiedAt || fullUser.emailVerifiedAt || fullUser.lastLoginMethod)),
      createdAt: toIso(fullUser?.createdAt),
    },
    voice: {
      totalCalls: voiceCallStatuses.length,
      answeredCalls: answeredCalls.length,
      missedCalls: missedCalls.length,
      attemptedCalls: attemptedCalls.length,
      openFollowUps: (voiceContext?.followUps.length || 0) + (voiceContext?.taskFollowUps.filter((task) => !["resolved", "closed"].includes(String(task.status || "").trim().toLowerCase())).length || 0),
      callbackRequests: callbackRequests.length,
      requestedCallbacks: callbackRequests.filter((request) => Boolean(request.requestedAt)).length,
      lastCallAt: toIso(latestCall?.call.startedAt ?? latestCall?.call.createdAt ?? null),
      lastCallStatus: latestCall?.displayStatus || null,
      lastCallStatusLabel: normalizeStatusLabel(latestCall?.displayStatus),
      lastCallId: latestCall?.call.id ?? null,
      lastCallDirection: latestCall?.call.direction ?? null,
      lastCallAgent: latestCall?.call.assignedTo?.name ?? latestCall?.call.assignedTo?.email ?? null,
      latestAssignedAgent:
        voiceContext?.assignedAgent?.name ??
        voiceContext?.assignedAgent?.email ??
        latestRequestedCallback?.agent?.name ??
        latestRequestedCallback?.agent?.email ??
        null,
      lastRequestedCallbackAt: toIso(latestRequestedCallback?.requestedAt),
      lastRequestedCallbackBy:
        latestRequestedCallback?.agent?.name ??
        latestRequestedCallback?.agent?.email ??
        null,
    },
    sales: {
      totalPurchasesValue: Number(voiceContext?.summary.totalPurchasesValue ?? 0),
      openQuotations: Number(voiceContext?.summary.openQuotations ?? 0),
      pendingWebOrders: Number(voiceContext?.summary.pendingWebOrders ?? 0),
      pendingPod: Number(voiceContext?.summary.pendingPod ?? 0),
      lastPurchaseAt: toIso(voiceContext?.summary.lastPurchaseAt),
      lastReceipt: latestReceipt
        ? {
            id: latestReceipt.id,
            receiptNumber: latestReceipt.receiptNumber,
            orderNumber: latestReceipt.orderNumber,
            totalAmount: latestReceipt.totalAmount,
            issuedAt: latestReceipt.issuedAt.toISOString(),
          }
        : null,
      lastWebOrder: latestWebOrder
        ? {
            id: latestWebOrder.id,
            orderRef: latestWebOrder.orderRef,
            total: latestWebOrder.total,
            status: latestWebOrder.status,
            createdAt: latestWebOrder.createdAt.toISOString(),
          }
        : null,
      lastQuotation: latestQuotation
        ? {
            id: latestQuotation.id,
            quoteRef: latestQuotation.quoteRef,
            status: latestQuotation.status,
            updatedAt: toIso(latestQuotation.updatedAt || latestQuotation.createdAt) || new Date().toISOString(),
          }
        : null,
      lastAgentOrder: latestAgentOrder
        ? {
            id: latestAgentOrder.id,
            productName: latestAgentOrder.productName,
            totalAmount: latestAgentOrder.totalAmount,
            status: latestAgentOrder.status,
            createdAt: latestAgentOrder.createdAt.toISOString(),
          }
        : null,
    },
    chatrace: mapChatrace(
      voiceContext?.chatrace || {
        found: false,
        normalizedPhone: basePhone || "",
        tags: [],
        customFields: [],
        lastMessagePreview: null,
        sourceError: false,
      },
    ),
    quickLinks: {
      voiceHistoryHref: basePhone ? buildVoiceHref({ selectedPhone: basePhone, tab: "recent" }) : null,
      lastCallHref:
        latestCall?.call.id && basePhone
          ? buildVoiceHref({ selectedPhone: basePhone, selectedCallId: latestCall.call.id, tab: "recent" })
          : basePhone
            ? buildVoiceHref({ selectedPhone: basePhone, tab: "recent" })
            : null,
      receiptDeskHref: latestReceipt ? buildReceiptDeskHref(latestReceipt.id) : "/marketing/receipts?tab=pos",
      lastReceiptHref: latestReceipt ? `/receipts/${encodeURIComponent(latestReceipt.id)}` : null,
      quotationHref: latestQuotation ? buildQuotationHref(latestQuotation.id) : "/marketing/receipts?tab=quotations",
      webOrdersHref: latestWebOrder ? buildWebOrdersHref(latestWebOrder.id) : "/marketing/receipts?tab=web-orders",
      chatraceInboxHref: voiceContext?.chatrace.inboxUrl ?? null,
    },
    timeline,
  };
}
