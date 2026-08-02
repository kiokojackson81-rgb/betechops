import { Prisma, ProjectNotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import { generateReceiptPdf } from "@/workers/receiptSender";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { pushReceiptToChatrace } from "@/lib/integrations/chatrace";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import { createReviewInvitation } from "@/lib/reviewsReferrals";
import { getPublicReceiptUrl } from "@/lib/publicReceiptLinks";
import {
  formatKenyaDate,
  formatKenyaNumber,
  isValidEmailAddress,
  normalizeProjectPhone,
} from "./project-notification.formatters";
import { hasProjectAssignmentChange, hasProjectBookingDate } from "./project-notification.logic";
import type {
  ProjectNotificationContext,
  ProjectNotificationDraft,
  ProjectNotificationChannelResult,
  ProjectNotificationEvent,
  ProjectNotificationPublishResult,
  ProjectNotificationQueueInput,
} from "./project-notification.types";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://ops.betech.co.ke";
}

function getProjectAdminWhatsApp() {
  return normalizeProjectPhone(
    process.env.PROJECT_ADMIN_WHATSAPP
      || process.env.CHATRACE_INTERNAL_ADMIN_PHONE
      || process.env.WHATSAPP_ADMIN_PHONE
      || process.env.ADMIN_NOTIFICATION_WHATSAPP_NUMBERS?.split(/[,\s;]+/g)[0]
      || "",
  );
}

const CUSTOMER_CHATRACE_ACCOUNT_ID = (process.env.CHATRACE_PROJECT_CUSTOMER_ACCOUNT_ID || "1705099").trim();
const INTERNAL_CHATRACE_ACCOUNT_ID = (process.env.CHATRACE_PROJECT_INTERNAL_ACCOUNT_ID || "1802145").trim();

const PROJECT_TRIGGER_TAGS = {
  customerBooked: "project_installation_booked_customer",
  customerCompleted: "project_completed_customer",
  adminBooked: "project_installation_booked_admin",
  handlerAssigned: "project_assigned_handler",
} as const;

function getProjectNumber(receipt: {
  id: string;
  receiptNumber: string | null;
  order: { orderNumber: string } | null;
}) {
  return receipt.order?.orderNumber || receipt.receiptNumber || receipt.id;
}

function buildVersionKey(context: ProjectNotificationContext) {
  return [
    context.projectNumber,
    context.installationDate || "",
    context.installationAddress || "",
    context.assignedHandlerName || "",
    context.assignedHandlerPhone || "",
    context.projectValue,
    context.amountPaid,
    context.balance,
    context.completionDate || "",
  ].join("|");
}

function buildIdempotencyKey(
  event: ProjectNotificationEvent,
  receiptId: string,
  versionKey: string,
  recipientType: string,
  channel: string,
) {
  return `${event}:${receiptId}:${versionKey}:${recipientType}:${channel}`;
}

function isBookedContext(context: ProjectNotificationContext) {
  return hasProjectBookingDate({ scheduledDate: context.installationDate });
}

async function loadProjectNotificationContext(
  input: ProjectNotificationQueueInput,
): Promise<ProjectNotificationContext | null> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: input.receiptId },
    include: {
      order: {
        include: {
          items: { include: { product: { select: { name: true } } } },
          attendant: { select: { id: true, name: true, email: true, phone: true, whatsappNumber: true, role: true } },
        },
      },
      issuedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!receipt) return null;

  const snapshot = buildReceiptSnapshot(receipt as any);
  const data =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  const projectFlow = readReceiptProjectFlow(data.projectFlow);
  if (!projectFlow?.isProject) return null;

  let assignedHandlerName: string | null = null;
  let assignedHandlerPhone: string | null = null;
  let assignedHandlerId: string | null = null;
  let completedByName: string | null = null;
  let completedByRole: string | null = null;
  let updatedByName: string | null = null;
  let bookedByName: string | null = receipt.issuedBy?.name ?? receipt.issuedBy?.email ?? null;

  if (projectFlow.handlerType === "STAFF" && projectFlow.handlerStaffId) {
    const handler = await prisma.user.findUnique({
      where: { id: projectFlow.handlerStaffId },
      select: { name: true, email: true, phone: true, whatsappNumber: true, role: true },
    });
    assignedHandlerId = projectFlow.handlerStaffId;
    assignedHandlerName = handler?.name ?? handler?.email ?? projectFlow.handlerStaffName ?? null;
    assignedHandlerPhone = normalizeProjectPhone(handler?.whatsappNumber ?? handler?.phone ?? null) || null;
  } else if (projectFlow.handlerType === "EXTERNAL") {
    assignedHandlerName = projectFlow.externalAgentName ?? null;
    assignedHandlerPhone = normalizeProjectPhone(projectFlow.externalAgentPhone ?? null) || null;
  } else {
    assignedHandlerName = projectFlow.handlerStaffName ?? null;
  }

  if (input.triggeredByUserId) {
    const actor = await prisma.user.findUnique({
      where: { id: input.triggeredByUserId },
      select: { name: true, email: true, role: true },
    });
    updatedByName = actor?.name ?? actor?.email ?? null;
    completedByName = actor?.name ?? actor?.email ?? null;
    completedByRole = actor?.role ?? null;
  }

  const projectValue = Number(receipt.order?.totalAmount ?? projectFlow.projectValue ?? 0) || 0;
  const amountPaid = Number(projectFlow.totalPaidAmount ?? receipt.order?.paidAmount ?? 0) || 0;
  const balance = Number(projectFlow.remainingAmount ?? Math.max(0, projectValue - amountPaid)) || 0;
  const receiptLink = await getPublicReceiptUrl(receipt.id);
  const reviewLink = input.event === "PROJECT_COMPLETED" ? await ensureProjectReviewLink(receipt.id) : null;

  return {
    receiptId: receipt.id,
    event: input.event,
    customerName: receipt.order?.customerName || snapshot.customerName || "Customer",
    customerPhone: normalizeProjectPhone(receipt.order?.customerPhone ?? String(data.customerPhone ?? "")) || null,
    customerEmail:
      typeof receipt.order?.customerEmail === "string" && receipt.order.customerEmail.trim()
        ? receipt.order.customerEmail.trim()
        : typeof data.customerEmail === "string" && data.customerEmail.trim()
          ? data.customerEmail.trim()
          : null,
    projectNumber: getProjectNumber(receipt),
    installationDate: projectFlow.scheduledDate ?? null,
    installationAddress: snapshot.deliveryAddress || null,
    projectValue,
    amountPaid,
    balance,
    receiptLink,
    receiptPdfLink: `${getSiteUrl().replace(/\/$/, "")}/api/receipts/${receipt.id}/pdf?download=1`,
    reviewLink,
    assignedHandlerName,
    assignedHandlerPhone,
    assignedHandlerId,
    bookedByName,
    updatedByName,
    completedByName,
    completedByRole,
    completionDate:
      input.event === "PROJECT_COMPLETED"
        ? projectFlow.updatedAt ?? receipt.createdAt.toISOString()
        : null,
    changedFields: input.changedFields ?? [],
    previousHandlerName: input.previousHandler?.name ?? null,
    previousHandlerPhone: normalizeProjectPhone(input.previousHandler?.phone ?? null) || null,
  };
}

function createDrafts(context: ProjectNotificationContext): ProjectNotificationDraft[] {
  const drafts: ProjectNotificationDraft[] = [];
  const versionKey = buildVersionKey(context);
  const baseSnapshot = {
    projectNumber: context.projectNumber,
    installationDate: formatKenyaDate(context.installationDate),
    installationAddress: context.installationAddress,
    projectValue: formatKenyaNumber(context.projectValue),
    amountPaid: formatKenyaNumber(context.amountPaid),
    balance: formatKenyaNumber(context.balance),
    receiptLink: context.receiptLink,
    reviewLink: context.reviewLink,
    changedFields: context.changedFields,
  };

  const pushDraft = (
    channel: ProjectNotificationDraft["channel"],
    recipientType: ProjectNotificationDraft["recipientType"],
    templateKey: string,
    recipientName?: string | null,
    recipientAddress?: string | null,
    errorMessage?: string | null,
  ) => {
    drafts.push({
      eventType: context.event,
      channel,
      recipientType,
      recipientName,
      recipientAddress,
      templateKey,
      idempotencyKey: buildIdempotencyKey(context.event, context.receiptId, versionKey, recipientType, channel),
      status: errorMessage ? "SKIPPED" : "PENDING",
      errorMessage: errorMessage ?? null,
      payloadSnapshot: {
        ...baseSnapshot,
        recipientName: recipientName ?? null,
        recipientAddress: recipientAddress ?? null,
      },
    });
  };

  if (context.event === "PROJECT_BOOKED" && isBookedContext(context)) {
    if (context.customerPhone) {
      pushDraft("WHATSAPP", "CUSTOMER", "project_installation_booked_customer", context.customerName, context.customerPhone);
      pushDraft("SMS", "CUSTOMER", "project_booking_customer_sms", context.customerName, context.customerPhone);
    } else {
      pushDraft("WHATSAPP", "CUSTOMER", "project_installation_booked_customer", context.customerName, null, "Missing customer phone number");
      pushDraft("SMS", "CUSTOMER", "project_booking_customer_sms", context.customerName, null, "Missing customer phone number");
    }

    if (isValidEmailAddress(context.customerEmail)) {
      pushDraft("EMAIL", "CUSTOMER", "project_booking_customer_email", context.customerName, context.customerEmail);
    } else {
      pushDraft("EMAIL", "CUSTOMER", "project_booking_customer_email", context.customerName, context.customerEmail, "Missing or invalid customer email");
    }

    const adminPhone = getProjectAdminWhatsApp();
    if (adminPhone) {
      pushDraft("WHATSAPP", "ADMIN", "project_installation_booked_admin", "Admin", adminPhone);
    } else {
      pushDraft("WHATSAPP", "ADMIN", "project_installation_booked_admin", "Admin", null, "Missing PROJECT_ADMIN_WHATSAPP");
    }
  }

  if (context.event === "PROJECT_BOOKING_UPDATED" && isBookedContext(context)) {
    if (
      context.changedFields.includes("handlerStaffId") ||
      context.changedFields.includes("handlerStaffName") ||
      context.changedFields.includes("handlerType") ||
      context.changedFields.includes("externalAgentPhone") ||
      context.changedFields.includes("externalAgentName")
    ) {
      if (context.assignedHandlerPhone) {
        const handlerVersion = context.assignedHandlerId || context.assignedHandlerPhone;
        pushDraft(
          "WHATSAPP",
          "ASSIGNED_HANDLER",
          "project_assigned_handler",
          context.assignedHandlerName,
          context.assignedHandlerPhone,
        );
        drafts[drafts.length - 1]!.idempotencyKey = buildIdempotencyKey(
          context.event,
          context.receiptId,
          `handler:${handlerVersion}`,
          "ASSIGNED_HANDLER",
          "WHATSAPP",
        );
      } else {
        pushDraft("WHATSAPP", "ASSIGNED_HANDLER", "project_assigned_handler", context.assignedHandlerName, null, "Missing assigned handler WhatsApp number");
      }
    }
  }

  if (context.event === "PROJECT_COMPLETED") {
    if (context.customerPhone) {
      pushDraft("WHATSAPP", "CUSTOMER", "project_completed_customer", context.customerName, context.customerPhone);
      pushDraft("SMS", "CUSTOMER", "project_completed_customer_sms", context.customerName, context.customerPhone);
    } else {
      pushDraft("WHATSAPP", "CUSTOMER", "project_completed_customer", context.customerName, null, "Missing customer phone number");
      pushDraft("SMS", "CUSTOMER", "project_completed_customer_sms", context.customerName, null, "Missing customer phone number");
    }

    if (isValidEmailAddress(context.customerEmail)) {
      pushDraft("EMAIL", "CUSTOMER", "project_completed_customer_email", context.customerName, context.customerEmail);
    } else {
      pushDraft("EMAIL", "CUSTOMER", "project_completed_customer_email", context.customerName, context.customerEmail, "Missing or invalid customer email");
    }
  }

  return drafts;
}

async function ensureLogs(context: ProjectNotificationContext) {
  const drafts = createDrafts(context);
  for (const draft of drafts) {
    try {
      await prisma.projectNotificationLog.upsert({
        where: { idempotencyKey: draft.idempotencyKey },
        update:
          draft.status === "SKIPPED"
            ? {
                recipientName: draft.recipientName ?? null,
                recipientAddress: draft.recipientAddress ?? null,
                templateKey: draft.templateKey,
                status: "SKIPPED",
                errorMessage: draft.errorMessage ?? null,
                payloadSnapshot: draft.payloadSnapshot as Prisma.InputJsonValue,
              }
            : {
                recipientName: draft.recipientName ?? null,
                recipientAddress: draft.recipientAddress ?? null,
                templateKey: draft.templateKey,
                errorMessage: null,
                failedAt: null,
                payloadSnapshot: draft.payloadSnapshot as Prisma.InputJsonValue,
                ...(draft.status === "PENDING"
                  ? {
                      status: {
                        set: "PENDING" as ProjectNotificationStatus,
                      },
                    }
                  : {}),
              },
        create: {
          receiptId: context.receiptId,
          eventType: draft.eventType,
          channel: draft.channel,
          recipientType: draft.recipientType,
          recipientName: draft.recipientName ?? null,
          recipientAddress: draft.recipientAddress ?? null,
          templateKey: draft.templateKey,
          idempotencyKey: draft.idempotencyKey,
          status: draft.status,
          errorMessage: draft.errorMessage ?? null,
          payloadSnapshot: draft.payloadSnapshot as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      console.error("[PROJECT_NOTIFY] log creation failed", {
        receiptId: context.receiptId,
        eventType: draft.eventType,
        idempotencyKey: draft.idempotencyKey,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
    }
  }
}

async function buildReceiptAttachment(receiptId: string, fileName: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      order: {
        include: {
          items: { include: { product: { select: { name: true } } } },
          attendant: { select: { name: true } },
        },
      },
      issuedBy: { select: { name: true } },
    },
  });
  if (!receipt) return null;
  const snapshot = buildReceiptSnapshot(receipt as any);
  const pdf = await generateReceiptPdf(snapshot, { hideStamp: false, htmlLabel: "project-notification" });
  if (!pdf?.length) return null;
  return {
    filename: fileName,
    content: pdf,
    contentType: "application/pdf",
    disposition: "attachment" as const,
  };
}

async function ensureProjectReviewLink(receiptId: string) {
  const existing = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT "publicToken" FROM "ReviewInvitation" WHERE "receiptId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    receiptId,
  );
  const existingToken = typeof existing[0]?.publicToken === "string" ? existing[0].publicToken.trim() : "";
  if (existingToken) {
    return `https://www.betech.co.ke/review/${existingToken}`;
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      order: {
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!receipt?.order) return null;
  const primaryItem = receipt.order.items.find((item) => item.productId) ?? receipt.order.items[0];
  if (!primaryItem?.productId) return null;

  const review = await createReviewInvitation({
    productId: primaryItem.productId,
    websiteOrderId: null,
    orderId: receipt.orderId,
    receiptId,
    customerUserId: null,
    customerName: receipt.order.customerName,
    customerPhone: receipt.order.customerPhone || "",
    customerEmail: receipt.order.customerEmail || null,
    customerTown: null,
    orderOrReceiptRef: receipt.order.orderNumber,
    purchaseDate: receipt.createdAt,
    deliveryMode: "project",
  });
  return review.reviewUrl;
}

async function findExistingSentLog(idempotencyKey: string) {
  try {
    return await prisma.projectNotificationLog.findFirst({
      where: {
        idempotencyKey,
        status: "SENT",
      },
    });
  } catch (error) {
    console.error("[PROJECT_NOTIFY] sent-log lookup failed", {
      idempotencyKey,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
    return null;
  }
}

async function markLogProcessing(idempotencyKey: string) {
  try {
    const current = await prisma.projectNotificationLog.findUnique({ where: { idempotencyKey } });
    if (!current) return null;
    return await prisma.projectNotificationLog.update({
      where: { id: current.id },
      data: {
        status: "PROCESSING",
        attemptCount: { increment: 1 },
        errorMessage: null,
        failedAt: null,
      },
    });
  } catch (error) {
    console.error("[PROJECT_NOTIFY] log processing update failed", {
      idempotencyKey,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
    return null;
  }
}

async function updateLogFinalState(input: {
  idempotencyKey: string;
  status: ProjectNotificationStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  payloadSnapshot?: Prisma.InputJsonValue;
}) {
  try {
    const current = await prisma.projectNotificationLog.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (!current) return;
    await prisma.projectNotificationLog.update({
      where: { id: current.id },
      data: {
        status: input.status,
        providerMessageId: input.providerMessageId ?? null,
        errorMessage: input.errorMessage ?? null,
        sentAt: input.status === "SENT" ? new Date() : null,
        failedAt: input.status === "FAILED" ? new Date() : null,
        payloadSnapshot: input.payloadSnapshot,
      },
    });
  } catch (error) {
    console.error("[PROJECT_NOTIFY] final log update failed", {
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
  }
}

function buildChannelResultKey(draft: ProjectNotificationDraft) {
  if (draft.recipientType === "CUSTOMER" && draft.channel === "WHATSAPP") return "customerWhatsApp";
  if (draft.recipientType === "CUSTOMER" && draft.channel === "SMS") return "customerSms";
  if (draft.recipientType === "CUSTOMER" && draft.channel === "EMAIL") return "customerEmail";
  if (draft.recipientType === "ADMIN" && draft.channel === "WHATSAPP") return "adminWhatsApp";
  if (draft.recipientType === "ASSIGNED_HANDLER" && draft.channel === "WHATSAPP") return "assignedHandlerWhatsApp";
  return `${draft.recipientType.toLowerCase()}${draft.channel.toLowerCase()}`;
}

function getExpectedProjectFlow(templateKey: string) {
  if (templateKey === "project_installation_booked_customer") return "Project Installation Booked - Customer";
  if (templateKey === "project_completed_customer") return "project_completed_customer";
  if (templateKey === "project_installation_booked_admin") return "Project Installation Booked - Admin";
  if (templateKey === "project_assigned_handler") return "project_assigned_handler";
  return templateKey;
}

function getProjectWhatsAppAccountId(templateKey: string) {
  return templateKey === "project_installation_booked_customer" || templateKey === "project_completed_customer"
    ? CUSTOMER_CHATRACE_ACCOUNT_ID
    : INTERNAL_CHATRACE_ACCOUNT_ID;
}

async function processDraft(
  draft: ProjectNotificationDraft,
  context: ProjectNotificationContext,
): Promise<ProjectNotificationChannelResult> {
  const resultBase = {
    key: buildChannelResultKey(draft),
    eventType: draft.eventType,
    channel: draft.channel,
    recipientType: draft.recipientType,
    templateKey: draft.templateKey,
    recipientAddress: draft.recipientAddress ?? null,
  } as const;

  const existingSent = await findExistingSentLog(draft.idempotencyKey);
  if (existingSent) {
    return {
      ...resultBase,
      status: "SKIPPED_ALREADY_SENT",
      providerMessageId: existingSent.providerMessageId ?? null,
      reason: "Already sent",
    };
  }

  if (draft.status === "SKIPPED") {
    await updateLogFinalState({
      idempotencyKey: draft.idempotencyKey,
      status: "SKIPPED",
      errorMessage: draft.errorMessage ?? null,
      payloadSnapshot: draft.payloadSnapshot as Prisma.InputJsonValue,
    });
    return {
      ...resultBase,
      status: "SKIPPED",
      reason: draft.errorMessage ?? "Skipped",
    };
  }

  await markLogProcessing(draft.idempotencyKey);

  console.info("[PROJECT_NOTIFY] channel dispatch starting", {
    receiptId: context.receiptId,
    eventType: draft.eventType,
    channel: draft.channel,
    recipientType: draft.recipientType,
    templateKey: draft.templateKey,
    recipientAddress: draft.recipientAddress ?? null,
  });

  try {
    let providerMessageId: string | null = null;
    let providerSnapshot: Prisma.InputJsonValue | undefined = undefined;
    if (draft.channel === "WHATSAPP") {
      if (!context.receiptLink) {
        throw new Error("Missing public receipt link");
      }
      const response =
        draft.templateKey === "project_installation_booked_customer"
          ? await pushReceiptToChatrace({
              accountId: CUSTOMER_CHATRACE_ACCOUNT_ID,
              phoneE164: draft.recipientAddress || "",
              customerName: context.customerName,
              receiptNumber: context.projectNumber,
              amount: formatKenyaNumber(context.amountPaid),
              currency: "KES",
              receiptLink: context.receiptLink,
              receiptId: context.receiptId,
              tagName: PROJECT_TRIGGER_TAGS.customerBooked,
              skipDefaultTags: true,
              forceTriggerTagReapply: true,
              extraFields: {
                customer_name: context.customerName,
                project_number: context.projectNumber,
                project_installation_date: formatKenyaDate(context.installationDate) || "",
                project_amount_paid: formatKenyaNumber(context.amountPaid),
                project_balance: formatKenyaNumber(context.balance),
                project_receipt_link: context.receiptLink,
              },
            })
          : draft.templateKey === "project_installation_booked_admin"
            ? await pushReceiptToChatrace({
                accountId: INTERNAL_CHATRACE_ACCOUNT_ID,
                phoneE164: draft.recipientAddress || "",
                customerName: "Admin",
                receiptNumber: context.projectNumber,
                amount: formatKenyaNumber(context.projectValue),
                currency: "KES",
                receiptLink: context.receiptLink,
                receiptId: context.receiptId,
                tagName: PROJECT_TRIGGER_TAGS.adminBooked,
                skipDefaultTags: true,
                forceTriggerTagReapply: true,
                extraFields: {
                  customer_name: context.customerName,
                  customer_phone: context.customerPhone || "",
                  project_number: context.projectNumber,
                  project_installation_date: formatKenyaDate(context.installationDate) || "",
                  project_value: formatKenyaNumber(context.projectValue),
                  project_amount_paid: formatKenyaNumber(context.amountPaid),
                  project_balance: formatKenyaNumber(context.balance),
                  project_created_by_name: context.bookedByName || context.updatedByName || "",
                  project_receipt_link: context.receiptLink,
                },
              })
            : draft.templateKey === "project_assigned_handler"
              ? await pushReceiptToChatrace({
                  accountId: INTERNAL_CHATRACE_ACCOUNT_ID,
                  phoneE164: draft.recipientAddress || "",
                  customerName: context.assignedHandlerName || "Handler",
                  receiptNumber: context.projectNumber,
                  amount: formatKenyaNumber(context.projectValue),
                  currency: "KES",
                  receiptLink: context.receiptLink,
                  receiptId: context.receiptId,
                  tagName: PROJECT_TRIGGER_TAGS.handlerAssigned,
                  skipDefaultTags: true,
                  forceTriggerTagReapply: true,
                  extraFields: {
                    project_assigned_handler_name: context.assignedHandlerName || "",
                    customer_name: context.customerName,
                    customer_phone: context.customerPhone || "",
                    project_number: context.projectNumber,
                    project_installation_date: formatKenyaDate(context.installationDate) || "",
                    project_value: formatKenyaNumber(context.projectValue),
                    project_amount_paid: formatKenyaNumber(context.amountPaid),
                    project_balance: formatKenyaNumber(context.balance),
                    project_installation_address: context.installationAddress || "",
                    project_receipt_link: context.receiptLink,
                  },
                })
              : await pushReceiptToChatrace({
                  accountId: CUSTOMER_CHATRACE_ACCOUNT_ID,
                  phoneE164: draft.recipientAddress || "",
                  customerName: context.customerName,
                  receiptNumber: context.projectNumber,
                  amount: formatKenyaNumber(context.amountPaid),
                  currency: "KES",
                  receiptLink: context.receiptLink,
                  receiptId: context.receiptId,
                  tagName: PROJECT_TRIGGER_TAGS.customerCompleted,
                  skipDefaultTags: true,
                  forceTriggerTagReapply: true,
                  extraFields: {
                    customer_name: context.customerName,
                    project_number: context.projectNumber,
                    project_value: formatKenyaNumber(context.projectValue),
                    project_amount_paid: formatKenyaNumber(context.amountPaid),
                    project_balance: formatKenyaNumber(context.balance),
                    project_final_receipt_link: context.receiptLink,
                    project_review_link: context.reviewLink || "",
                  },
                });
      if (!response.ok) {
        throw new Error(String(response.debug?.error || "ChatRace sync failed"));
      }
      const projectWhatsAppDiagnostic = {
        accountId: getProjectWhatsAppAccountId(draft.templateKey),
        recipientPhone: draft.recipientAddress ?? null,
        contactUpdated: Boolean(response.debug?.contactUpdated),
        tagRemoved: Boolean(response.debug?.tagRemoved),
        tagApplied: Boolean(response.debug?.tagApplied),
        tagVerified: Boolean(response.debug?.tagVerified),
        tagName:
          draft.templateKey === "project_installation_booked_customer"
            ? PROJECT_TRIGGER_TAGS.customerBooked
            : draft.templateKey === "project_installation_booked_admin"
              ? PROJECT_TRIGGER_TAGS.adminBooked
              : draft.templateKey === "project_assigned_handler"
                ? PROJECT_TRIGGER_TAGS.handlerAssigned
                : PROJECT_TRIGGER_TAGS.customerCompleted,
        flowExpected: getExpectedProjectFlow(draft.templateKey),
        providerStatus: String(response.debug?.providerStatus || "SUCCESS"),
        providerError: response.debug?.error ?? null,
      };
      console.info("[PROJECT_WHATSAPP] diagnostic", {
        receiptId: context.receiptId,
        eventType: draft.eventType,
        recipientType: draft.recipientType,
        templateKey: draft.templateKey,
        diagnostic: projectWhatsAppDiagnostic,
        contactResult: response.debug?.steps?.create
          ? {
              status: response.debug.steps.create.status ?? null,
              ok: response.debug.steps.create.ok ?? null,
              bodySnippet: response.debug.steps.create.bodySnippet ?? null,
            }
          : null,
        tagResult: response.debug?.steps?.tag
          ? {
              remove: response.debug.steps.tag.remove
                ? {
                    status: response.debug.steps.tag.remove.status ?? null,
                    ok: response.debug.steps.tag.remove.ok ?? null,
                    bodySnippet: response.debug.steps.tag.remove.bodySnippet ?? null,
                  }
                : null,
              apply: response.debug.steps.tag.apply
                ? {
                    status: response.debug.steps.tag.apply.status ?? null,
                    ok: response.debug.steps.tag.apply.ok ?? null,
                    bodySnippet: response.debug.steps.tag.apply.bodySnippet ?? null,
                  }
                : null,
            }
          : null,
      });
      providerMessageId =
        response.debug?.contactId == null ? null : String(response.debug.contactId);
      providerSnapshot = {
        ...(draft.payloadSnapshot ?? {}),
        chatraceAccountId: getProjectWhatsAppAccountId(draft.templateKey),
        triggerTag:
          draft.templateKey === "project_installation_booked_customer"
            ? PROJECT_TRIGGER_TAGS.customerBooked
            : draft.templateKey === "project_installation_booked_admin"
              ? PROJECT_TRIGGER_TAGS.adminBooked
              : draft.templateKey === "project_assigned_handler"
                ? PROJECT_TRIGGER_TAGS.handlerAssigned
                : PROJECT_TRIGGER_TAGS.customerCompleted,
        diagnostic: projectWhatsAppDiagnostic,
        providerResponse: response.debug,
      } as Prisma.InputJsonValue;
    } else if (draft.channel === "SMS") {
      const body =
        draft.templateKey === "project_booking_customer_sms"
          ? `Hi ${context.customerName}. Your installation has been booked. Project No: ${context.projectNumber}. Installation Date: ${formatKenyaDate(context.installationDate) || ""}. Paid: KSh ${formatKenyaNumber(context.amountPaid)}. Balance: KSh ${formatKenyaNumber(context.balance)}. Receipt: ${context.receiptLink}. - Betech Solar Solutions`
          : `Hi ${context.customerName}. Project No. ${context.projectNumber} has been completed successfully. Total Paid: KSh ${formatKenyaNumber(context.amountPaid)}. Balance: KSh ${formatKenyaNumber(context.balance)}. Receipt: ${context.receiptLink}. Thank you for choosing Betech Solar Solutions.`;
      const response = (await sendTransactionalSms(draft.recipientAddress || "", body)) as {
        SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
      };
      providerMessageId = response.SMSMessageData?.Recipients?.[0]?.messageId ?? null;
      providerSnapshot = {
        ...(draft.payloadSnapshot ?? {}),
        provider: "africasTalking",
        providerResponse: response,
      } as Prisma.InputJsonValue;
    } else if (draft.channel === "EMAIL") {
      if (!context.receiptLink) {
        throw new Error("Missing public receipt link");
      }
      const attachmentName =
        draft.templateKey === "project_booking_customer_email"
          ? `Betech-${context.projectNumber}-Receipt.pdf`
          : `Betech-${context.projectNumber}-Final-Receipt.pdf`;
      const attachment = await buildReceiptAttachment(context.receiptId, attachmentName);
      console.info("[PROJECT_NOTIFY] email eligibility", {
        receiptId: context.receiptId,
        customerEmail: context.customerEmail,
        valid: isValidEmailAddress(context.customerEmail),
        receiptPdfAvailable: Boolean(attachment),
        publicReceiptLinkAvailable: Boolean(context.receiptLink),
      });
      const response = await sendGeneralCustomerNotificationEmail({
        to: draft.recipientAddress || "",
        subject:
          draft.templateKey === "project_booking_customer_email"
            ? `Installation Booking Confirmation - Project No. ${context.projectNumber}`
            : `Project Completion - ${context.projectNumber}`,
        title:
          draft.templateKey === "project_booking_customer_email"
            ? "Installation booking confirmation"
            : "Project completion",
        intro: `Dear ${context.customerName},`,
        bodyHtml:
          draft.templateKey === "project_booking_customer_email"
            ? `<p>We are pleased to confirm that your installation has been successfully booked.</p>
               <p><strong>Project Number:</strong> ${context.projectNumber}<br />
               <strong>Installation Date:</strong> ${formatKenyaDate(context.installationDate) || ""}<br />
               <strong>Amount Paid So Far:</strong> KSh ${formatKenyaNumber(context.amountPaid)}<br />
               <strong>Outstanding Balance:</strong> KSh ${formatKenyaNumber(context.balance)}</p>
               <p>Please find your project receipt attached. You can also view or download it using the link below:</p>
               <p><a href="${context.receiptLink}">${context.receiptLink}</a></p>`
            : `<p>We are pleased to confirm that your installation under Project No. ${context.projectNumber} has been successfully completed.</p>
               <p><strong>Project Value:</strong> KSh ${formatKenyaNumber(context.projectValue)}<br />
               <strong>Total Paid:</strong> KSh ${formatKenyaNumber(context.amountPaid)}<br />
               <strong>Outstanding Balance:</strong> KSh ${formatKenyaNumber(context.balance)}</p>
               <p>Please find your receipt attached. You can also view or download it using the link below:</p>
               <p><a href="${context.receiptLink}">${context.receiptLink}</a></p>
               ${context.reviewLink ? `<p>Share your review here: <a href="${context.reviewLink}">${context.reviewLink}</a></p>` : ""}`,
        ctaLabel: "View receipt",
        ctaUrl: context.receiptLink,
        outro: "Kind regards,\nBetech Solar Solutions",
        attachments: attachment ? [attachment] : undefined,
      });
      providerMessageId = typeof response?.messageId === "string" ? response.messageId : null;
      providerSnapshot = {
        ...(draft.payloadSnapshot ?? {}),
        provider: "email",
        providerResponse: response,
      } as Prisma.InputJsonValue;
    }

    await updateLogFinalState({
      idempotencyKey: draft.idempotencyKey,
      status: "SENT",
      providerMessageId,
      payloadSnapshot: providerSnapshot,
    });
    const result: ProjectNotificationChannelResult = {
      ...resultBase,
      status: "SENT",
      providerMessageId,
    };
    console.info("[PROJECT_NOTIFY] channel dispatch result", {
      receiptId: context.receiptId,
      eventType: draft.eventType,
      result,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateLogFinalState({
      idempotencyKey: draft.idempotencyKey,
      status: draft.recipientAddress ? "FAILED" : "SKIPPED",
      errorMessage: message,
    });
    console.error("[PROJECT_NOTIFY] channel dispatch failed", {
      receiptId: context.receiptId,
      eventType: draft.eventType,
      channel: draft.channel,
      recipientType: draft.recipientType,
      recipientAddress: draft.recipientAddress ?? null,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
    return {
      ...resultBase,
      status: draft.recipientAddress ? "FAILED" : "SKIPPED",
      error: message,
      reason: draft.recipientAddress ? null : message,
    };
  }
}

function formatSettledResult(
  settled: PromiseSettledResult<ProjectNotificationChannelResult>,
): ProjectNotificationChannelResult {
  if (settled.status === "fulfilled") return settled.value;
  return {
    key: "unknown",
    eventType: "PROJECT_BOOKING_UPDATED",
    channel: "WHATSAPP",
    recipientType: "ADMIN",
    templateKey: "unknown",
    recipientAddress: null,
    status: "FAILED",
    error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
  };
}

export async function publishProjectNotification(
  input: ProjectNotificationQueueInput,
): Promise<ProjectNotificationPublishResult> {
  const context = await loadProjectNotificationContext(input);
  if (!context) {
    console.warn("[PROJECT_NOTIFY] no context loaded", {
      receiptId: input.receiptId,
      eventType: input.event,
    });
    return {
      receiptId: input.receiptId,
      eventType: input.event,
      dispatched: false,
      results: [],
    };
  }

  if ((input.event === "PROJECT_BOOKED" || input.event === "PROJECT_BOOKING_UPDATED") && !isBookedContext(context)) {
    console.warn("[PROJECT_NOTIFY] event skipped because booking data is incomplete", {
      receiptId: input.receiptId,
      eventType: input.event,
      installationDate: context.installationDate,
    });
    return {
      receiptId: input.receiptId,
      eventType: input.event,
      dispatched: false,
      results: [],
    };
  }

  await ensureLogs(context);
  const drafts = createDrafts(context).filter((draft) => {
    if (draft.eventType === "PROJECT_BOOKING_UPDATED") {
      return hasProjectAssignmentChange(context.changedFields);
    }
    return true;
  });
  console.info("[PROJECT_NOTIFY] dispatch starting", {
    receiptId: input.receiptId,
    eventType: input.event,
    draftCount: drafts.length,
  });
  const settled = await Promise.allSettled(drafts.map((draft) => processDraft(draft, context)));
  const results = settled.map(formatSettledResult);
  console.info("[PROJECT_NOTIFY] dispatch result", {
    receiptId: input.receiptId,
    eventType: input.event,
    results,
  });
  return {
    receiptId: input.receiptId,
    eventType: input.event,
    dispatched: drafts.length > 0,
    results,
  };
}

export async function processProjectNotificationQueue(input: ProjectNotificationQueueInput) {
  return publishProjectNotification(input);
}

export async function queueProjectNotification(input: ProjectNotificationQueueInput) {
  return publishProjectNotification(input);
}
