import { Prisma, ProjectNotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import { generateReceiptPdf } from "@/workers/receiptSender";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { hasWhatsAppConfig, sendWhatsAppTextMessage } from "@/lib/notifications/whatsapp";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import {
  buildProjectBookingAdminWhatsApp,
  buildProjectBookingCustomerEmail,
  buildProjectBookingCustomerSms,
  buildProjectBookingCustomerWhatsApp,
  buildProjectBookingHandlerWhatsApp,
  buildProjectBookingUpdateAdminWhatsApp,
  buildProjectBookingUpdateCustomerSms,
  buildProjectBookingUpdateCustomerWhatsApp,
  buildProjectCompletedAdminWhatsApp,
  buildProjectCompletedCustomerEmail,
  buildProjectCompletedCustomerSms,
  buildProjectCompletedCustomerWhatsApp,
  buildProjectCompletedHandlerWhatsApp,
  buildProjectReassignedWhatsApp,
} from "./project-notification.templates";
import {
  formatKenyaDate,
  isValidEmailAddress,
  normalizeProjectPhone,
  sanitizeWhatsAppPhone,
} from "./project-notification.formatters";
import type {
  ProjectNotificationContext,
  ProjectNotificationDraft,
  ProjectNotificationEvent,
  ProjectNotificationQueueInput,
} from "./project-notification.types";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://ops.betech.co.ke";
}

function getProjectAdminWhatsApp() {
  return normalizeProjectPhone(process.env.PROJECT_ADMIN_WHATSAPP || process.env.ADMIN_NOTIFICATION_WHATSAPP_NUMBERS?.split(/[,\s;]+/g)[0] || "");
}

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
  return Boolean(context.installationDate && context.assignedHandlerName);
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
  let completedByName: string | null = null;
  let completedByRole: string | null = null;
  let updatedByName: string | null = null;
  let bookedByName: string | null = receipt.issuedBy?.name ?? receipt.issuedBy?.email ?? null;

  if (projectFlow.handlerType === "STAFF" && projectFlow.handlerStaffId) {
    const handler = await prisma.user.findUnique({
      where: { id: projectFlow.handlerStaffId },
      select: { name: true, email: true, phone: true, whatsappNumber: true, role: true },
    });
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
  const receiptLink = `${getSiteUrl().replace(/\/$/, "")}/receipts/${receipt.id}`;

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
    assignedHandlerName,
    assignedHandlerPhone,
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
    projectValue: context.projectValue,
    amountPaid: context.amountPaid,
    balance: context.balance,
    receiptLink: context.receiptLink,
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
      pushDraft("WHATSAPP", "CUSTOMER", "project_booking_customer_whatsapp", context.customerName, context.customerPhone);
      pushDraft("SMS", "CUSTOMER", "project_booking_customer_sms", context.customerName, context.customerPhone);
    } else {
      pushDraft("WHATSAPP", "CUSTOMER", "project_booking_customer_whatsapp", context.customerName, null, "Missing customer phone number");
      pushDraft("SMS", "CUSTOMER", "project_booking_customer_sms", context.customerName, null, "Missing customer phone number");
    }

    if (isValidEmailAddress(context.customerEmail)) {
      pushDraft("EMAIL", "CUSTOMER", "project_booking_customer_email", context.customerName, context.customerEmail);
    } else {
      pushDraft("EMAIL", "CUSTOMER", "project_booking_customer_email", context.customerName, context.customerEmail, "Missing or invalid customer email");
    }

    const adminPhone = getProjectAdminWhatsApp();
    if (adminPhone) {
      pushDraft("WHATSAPP", "ADMIN", "project_booking_admin_whatsapp", "Admin", adminPhone);
    } else {
      pushDraft("WHATSAPP", "ADMIN", "project_booking_admin_whatsapp", "Admin", null, "Missing PROJECT_ADMIN_WHATSAPP");
    }

    if (context.assignedHandlerPhone) {
      pushDraft("WHATSAPP", "ASSIGNED_HANDLER", "project_booking_handler_whatsapp", context.assignedHandlerName, context.assignedHandlerPhone);
    } else {
      pushDraft("WHATSAPP", "ASSIGNED_HANDLER", "project_booking_handler_whatsapp", context.assignedHandlerName, null, "Missing assigned handler WhatsApp number");
    }
  }

  if (context.event === "PROJECT_BOOKING_UPDATED" && isBookedContext(context)) {
    if (context.customerPhone) {
      pushDraft("WHATSAPP", "CUSTOMER", "project_booking_updated_customer_whatsapp", context.customerName, context.customerPhone);
      pushDraft("SMS", "CUSTOMER", "project_booking_updated_customer_sms", context.customerName, context.customerPhone);
    } else {
      pushDraft("WHATSAPP", "CUSTOMER", "project_booking_updated_customer_whatsapp", context.customerName, null, "Missing customer phone number");
      pushDraft("SMS", "CUSTOMER", "project_booking_updated_customer_sms", context.customerName, null, "Missing customer phone number");
    }

    const adminPhone = getProjectAdminWhatsApp();
    if (adminPhone) {
      pushDraft("WHATSAPP", "ADMIN", "project_booking_updated_admin_whatsapp", "Admin", adminPhone);
    } else {
      pushDraft("WHATSAPP", "ADMIN", "project_booking_updated_admin_whatsapp", "Admin", null, "Missing PROJECT_ADMIN_WHATSAPP");
    }

    if (context.changedFields.includes("handlerStaffId") || context.changedFields.includes("externalAgentPhone")) {
      if (context.assignedHandlerPhone) {
        pushDraft("WHATSAPP", "ASSIGNED_HANDLER", "project_booking_handler_whatsapp", context.assignedHandlerName, context.assignedHandlerPhone);
      } else {
        pushDraft("WHATSAPP", "ASSIGNED_HANDLER", "project_booking_handler_whatsapp", context.assignedHandlerName, null, "Missing assigned handler WhatsApp number");
      }
      if (context.previousHandlerPhone) {
        pushDraft("WHATSAPP", "PREVIOUS_HANDLER", "project_reassigned_handler_whatsapp", context.previousHandlerName, context.previousHandlerPhone);
      }
    }
  }

  if (context.event === "PROJECT_COMPLETED") {
    if (context.customerPhone) {
      pushDraft("WHATSAPP", "CUSTOMER", "project_completed_customer_whatsapp", context.customerName, context.customerPhone);
      pushDraft("SMS", "CUSTOMER", "project_completed_customer_sms", context.customerName, context.customerPhone);
    } else {
      pushDraft("WHATSAPP", "CUSTOMER", "project_completed_customer_whatsapp", context.customerName, null, "Missing customer phone number");
      pushDraft("SMS", "CUSTOMER", "project_completed_customer_sms", context.customerName, null, "Missing customer phone number");
    }

    if (isValidEmailAddress(context.customerEmail)) {
      pushDraft("EMAIL", "CUSTOMER", "project_completed_customer_email", context.customerName, context.customerEmail);
    } else {
      pushDraft("EMAIL", "CUSTOMER", "project_completed_customer_email", context.customerName, context.customerEmail, "Missing or invalid customer email");
    }

    const adminPhone = getProjectAdminWhatsApp();
    if (adminPhone) {
      pushDraft("WHATSAPP", "ADMIN", "project_completed_admin_whatsapp", "Admin", adminPhone);
    } else {
      pushDraft("WHATSAPP", "ADMIN", "project_completed_admin_whatsapp", "Admin", null, "Missing PROJECT_ADMIN_WHATSAPP");
    }

    const notifyHandlerPhone = context.assignedHandlerPhone || context.previousHandlerPhone;
    const notifyHandlerName = context.assignedHandlerName || context.completedByName;
    if (notifyHandlerPhone) {
      pushDraft("WHATSAPP", "COMPLETING_USER", "project_completed_handler_whatsapp", notifyHandlerName, notifyHandlerPhone);
    } else {
      pushDraft("WHATSAPP", "COMPLETING_USER", "project_completed_handler_whatsapp", notifyHandlerName, null, "Missing handler WhatsApp number");
    }
  }

  return drafts;
}

async function ensureLogs(context: ProjectNotificationContext) {
  const drafts = createDrafts(context);
  for (const draft of drafts) {
    await prisma.projectNotificationLog.upsert({
      where: { idempotencyKey: draft.idempotencyKey },
      update: {},
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

async function sendWhatsApp(recipientAddress: string, body: string) {
  if (!hasWhatsAppConfig()) {
    throw new Error("WhatsApp Business configuration is missing");
  }
  return sendWhatsAppTextMessage({
    to: sanitizeWhatsAppPhone(recipientAddress),
    body,
    previewUrl: true,
  });
}

async function processLog(logId: string, context: ProjectNotificationContext) {
  const log = await prisma.projectNotificationLog.findUnique({ where: { id: logId } });
  if (!log || log.status === ProjectNotificationStatus.SENT || log.status === ProjectNotificationStatus.SKIPPED) return;

  await prisma.projectNotificationLog.update({
    where: { id: log.id },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      errorMessage: null,
      failedAt: null,
    },
  });

  try {
    let providerMessageId: string | null = null;
    if (log.channel === "WHATSAPP") {
      const body =
        log.templateKey === "project_booking_customer_whatsapp"
          ? buildProjectBookingCustomerWhatsApp(context)
          : log.templateKey === "project_booking_admin_whatsapp"
            ? buildProjectBookingAdminWhatsApp(context)
            : log.templateKey === "project_booking_handler_whatsapp"
              ? buildProjectBookingHandlerWhatsApp(context)
              : log.templateKey === "project_booking_updated_customer_whatsapp"
                ? buildProjectBookingUpdateCustomerWhatsApp(context)
                : log.templateKey === "project_booking_updated_admin_whatsapp"
                  ? buildProjectBookingUpdateAdminWhatsApp(context)
                  : log.templateKey === "project_reassigned_handler_whatsapp"
                    ? buildProjectReassignedWhatsApp(context)
                    : log.templateKey === "project_completed_customer_whatsapp"
                      ? buildProjectCompletedCustomerWhatsApp(context)
                      : log.templateKey === "project_completed_admin_whatsapp"
                        ? buildProjectCompletedAdminWhatsApp(context)
                        : buildProjectCompletedHandlerWhatsApp(context);
      const response = await sendWhatsApp(log.recipientAddress || "", body);
      providerMessageId =
        typeof (response as { messages?: Array<{ id?: string }> }).messages?.[0]?.id === "string"
          ? (response as { messages?: Array<{ id?: string }> }).messages![0]!.id || null
          : null;
    } else if (log.channel === "SMS") {
      const body =
        log.templateKey === "project_booking_customer_sms"
          ? buildProjectBookingCustomerSms(context)
          : log.templateKey === "project_booking_updated_customer_sms"
            ? buildProjectBookingUpdateCustomerSms(context)
            : buildProjectCompletedCustomerSms(context);
      const response = (await sendTransactionalSms(log.recipientAddress || "", body)) as {
        SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
      };
      providerMessageId = response.SMSMessageData?.Recipients?.[0]?.messageId ?? null;
    } else if (log.channel === "EMAIL") {
      const bookingEmail =
        log.templateKey === "project_booking_customer_email"
          ? buildProjectBookingCustomerEmail(context)
          : buildProjectCompletedCustomerEmail(context);
      const attachmentName =
        log.templateKey === "project_booking_customer_email"
          ? `Betech-${context.projectNumber}-Receipt.pdf`
          : `Betech-${context.projectNumber}-Final-Receipt.pdf`;
      const attachment = await buildReceiptAttachment(context.receiptId, attachmentName);
      const response = await sendGeneralCustomerNotificationEmail({
        to: log.recipientAddress || "",
        subject: bookingEmail.subject,
        title: bookingEmail.title,
        intro: bookingEmail.intro,
        bodyHtml: bookingEmail.bodyHtml,
        ctaLabel: "View receipt",
        ctaUrl: context.receiptLink,
        outro: "Kind regards,\nBetech Solar Solutions",
        attachments: attachment ? [attachment] : undefined,
      });
      providerMessageId = typeof response?.messageId === "string" ? response.messageId : null;
    }

    await prisma.projectNotificationLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        providerMessageId,
        sentAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.projectNotificationLog.update({
      where: { id: log.id },
      data: {
        status: log.recipientAddress ? "FAILED" : "SKIPPED",
        errorMessage: message,
        failedAt: new Date(),
      },
    });
  }
}

export async function processProjectNotificationQueue(input: ProjectNotificationQueueInput) {
  const context = await loadProjectNotificationContext(input);
  if (!context) return;

  const pendingLogs = await prisma.projectNotificationLog.findMany({
    where: {
      receiptId: input.receiptId,
      eventType: input.event,
      status: { in: ["PENDING", "FAILED"] },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const log of pendingLogs) {
    await processLog(log.id, context);
  }
}

export async function queueProjectNotification(input: ProjectNotificationQueueInput) {
  const context = await loadProjectNotificationContext(input);
  if (!context) return;
  if ((input.event === "PROJECT_BOOKED" || input.event === "PROJECT_BOOKING_UPDATED") && !isBookedContext(context)) {
    return;
  }

  await ensureLogs(context);
  void processProjectNotificationQueue(input).catch((error) => {
    console.error("[project-notifications] background processing failed", {
      receiptId: input.receiptId,
      event: input.event,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
