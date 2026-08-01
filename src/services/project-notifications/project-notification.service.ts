import { randomUUID } from "node:crypto";
import { Prisma, ProjectNotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import { generateReceiptPdf } from "@/workers/receiptSender";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import { createReviewInvitation } from "@/lib/reviewsReferrals";
import { getPublicReceiptUrl } from "@/lib/publicReceiptLinks";
import {
  formatKenyaDate,
  formatKenyaNumber,
  isValidEmailAddress,
  normalizeProjectPhone,
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

const CUSTOMER_CHATRACE_ACCOUNT_ID = (process.env.CHATRACE_PROJECT_CUSTOMER_ACCOUNT_ID || "1705099").trim();
const INTERNAL_CHATRACE_ACCOUNT_ID = (process.env.CHATRACE_PROJECT_INTERNAL_ACCOUNT_ID || "1802145").trim();
const CHATRACE_BASE_URL = (process.env.CHATRACE_BASE_URL || "https://api.chatrace.com").replace(/\/$/, "");
const CHATRACE_API_TOKEN = (process.env.CHATRACE_API_TOKEN || "").trim();

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

function sanitizeChatracePhone(phone: string) {
  return phone.replace(/^\+/, "");
}

function ensureChatraceConfig(accountId: string) {
  if (!CHATRACE_API_TOKEN || !CHATRACE_BASE_URL || !accountId) {
    throw new Error("Missing ChatRace configuration.");
  }
}

async function postChatraceActions(input: {
  accountId: string;
  phone: string;
  firstName: string;
  actions: Array<Record<string, unknown>>;
}) {
  ensureChatraceConfig(input.accountId);
  const response = await fetch(`${CHATRACE_BASE_URL}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-ACCESS-TOKEN": CHATRACE_API_TOKEN,
      "X-ACCOUNT-ID": input.accountId,
    },
    body: JSON.stringify({
      phone: sanitizeChatracePhone(input.phone),
      first_name: input.firstName,
      actions: input.actions,
    }),
  });
  const raw = await response.text().catch(() => "");
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return {
    ok: response.ok && Boolean((json as { success?: boolean } | null)?.success ?? response.ok),
    status: response.status,
    raw,
    json,
    contactId: ((json as { data?: { id?: string | number }; id?: string | number } | null)?.data?.id ??
      (json as { id?: string | number } | null)?.id ??
      null) as string | number | null,
  };
}

function buildChatraceSetField(fieldName: string, value: string | number | null | undefined) {
  return {
    action: "set_field_value",
    field_name: fieldName,
    value:
      typeof value === "number"
        ? value
        : String(value ?? "")
            .replace(/[\r\n\t]+/g, " ")
            .replace(/ {2,}/g, " ")
            .trim(),
  };
}

async function triggerChatraceFlow(input: {
  accountId: string;
  phone: string;
  firstName: string;
  fields: Record<string, string | number | null | undefined>;
  triggerTag: string;
}) {
  const fieldActions = Object.entries(input.fields).map(([fieldName, value]) => buildChatraceSetField(fieldName, value));
  const fieldsResult = await postChatraceActions({
    accountId: input.accountId,
    phone: input.phone,
    firstName: input.firstName,
    actions: fieldActions,
  });
  if (!fieldsResult.ok) {
    return {
      ok: false,
      accountId: input.accountId,
      contactId: fieldsResult.contactId ? String(fieldsResult.contactId) : null,
      providerResponse: {
        fields: { status: fieldsResult.status, raw: fieldsResult.raw, json: fieldsResult.json },
      },
      error: "chatrace_field_sync_failed",
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 400));

  const tagActions = [
    { action: "remove_tag", tag_name: input.triggerTag },
    { action: "add_tag", tag_name: input.triggerTag },
  ];
  const tagResult = await postChatraceActions({
    accountId: input.accountId,
    phone: input.phone,
    firstName: input.firstName,
    actions: tagActions,
  });

  return {
    ok: tagResult.ok,
    accountId: input.accountId,
    contactId: fieldsResult.contactId ? String(fieldsResult.contactId) : tagResult.contactId ? String(tagResult.contactId) : null,
    providerResponse: {
      fields: { status: fieldsResult.status, raw: fieldsResult.raw, json: fieldsResult.json },
      tag: { status: tagResult.status, raw: tagResult.raw, json: tagResult.json },
    },
    error: tagResult.ok ? null : "chatrace_tag_sync_failed",
  };
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
      const response =
        log.templateKey === "project_installation_booked_customer"
          ? await triggerChatraceFlow({
              accountId: CUSTOMER_CHATRACE_ACCOUNT_ID,
              phone: log.recipientAddress || "",
              firstName: context.customerName.split(/\s+/)[0] || "Customer",
              triggerTag: PROJECT_TRIGGER_TAGS.customerBooked,
              fields: {
                customer_name: context.customerName,
                project_number: context.projectNumber,
                project_installation_date: formatKenyaDate(context.installationDate) || "",
                project_amount_paid: formatKenyaNumber(context.amountPaid),
                project_balance: formatKenyaNumber(context.balance),
                project_receipt_link: context.receiptLink,
              },
            })
          : log.templateKey === "project_installation_booked_admin"
            ? await triggerChatraceFlow({
                accountId: INTERNAL_CHATRACE_ACCOUNT_ID,
                phone: log.recipientAddress || "",
                firstName: "Admin",
                triggerTag: PROJECT_TRIGGER_TAGS.adminBooked,
                fields: {
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
            : log.templateKey === "project_assigned_handler"
              ? await triggerChatraceFlow({
                  accountId: INTERNAL_CHATRACE_ACCOUNT_ID,
                  phone: log.recipientAddress || "",
                  firstName: context.assignedHandlerName?.split(/\s+/)[0] || "Handler",
                  triggerTag: PROJECT_TRIGGER_TAGS.handlerAssigned,
                  fields: {
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
              : await triggerChatraceFlow({
                  accountId: CUSTOMER_CHATRACE_ACCOUNT_ID,
                  phone: log.recipientAddress || "",
                  firstName: context.customerName.split(/\s+/)[0] || "Customer",
                  triggerTag: PROJECT_TRIGGER_TAGS.customerCompleted,
                  fields: {
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
        throw new Error(response.error || "ChatRace sync failed");
      }
      providerMessageId = response.contactId;
      await prisma.projectNotificationLog.update({
        where: { id: log.id },
        data: {
          payloadSnapshot: {
            ...(log.payloadSnapshot && typeof log.payloadSnapshot === "object" && !Array.isArray(log.payloadSnapshot)
              ? (log.payloadSnapshot as Record<string, unknown>)
              : {}),
            chatraceAccountId: response.accountId,
            triggerTag:
              log.templateKey === "project_installation_booked_customer"
                ? PROJECT_TRIGGER_TAGS.customerBooked
                : log.templateKey === "project_installation_booked_admin"
                  ? PROJECT_TRIGGER_TAGS.adminBooked
                  : log.templateKey === "project_assigned_handler"
                    ? PROJECT_TRIGGER_TAGS.handlerAssigned
                    : PROJECT_TRIGGER_TAGS.customerCompleted,
            providerResponse: response.providerResponse,
          } as Prisma.InputJsonValue,
        },
      });
    } else if (log.channel === "SMS") {
      const body =
        log.templateKey === "project_booking_customer_sms"
          ? `Hi ${context.customerName}. Your installation has been booked. Project No: ${context.projectNumber}. Installation Date: ${formatKenyaDate(context.installationDate) || ""}. Paid: KSh ${formatKenyaNumber(context.amountPaid)}. Balance: KSh ${formatKenyaNumber(context.balance)}. Receipt: ${context.receiptLink}. - Betech Solar Solutions`
          : `Hi ${context.customerName}. Project No. ${context.projectNumber} has been completed successfully. Total Paid: KSh ${formatKenyaNumber(context.amountPaid)}. Balance: KSh ${formatKenyaNumber(context.balance)}. Receipt: ${context.receiptLink}. Thank you for choosing Betech Solar Solutions.`;
      const response = (await sendTransactionalSms(log.recipientAddress || "", body)) as {
        SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
      };
      providerMessageId = response.SMSMessageData?.Recipients?.[0]?.messageId ?? null;
    } else if (log.channel === "EMAIL") {
      const attachmentName =
        log.templateKey === "project_booking_customer_email"
          ? `Betech-${context.projectNumber}-Receipt.pdf`
          : `Betech-${context.projectNumber}-Final-Receipt.pdf`;
      const attachment = await buildReceiptAttachment(context.receiptId, attachmentName);
      const response = await sendGeneralCustomerNotificationEmail({
        to: log.recipientAddress || "",
        subject:
          log.templateKey === "project_booking_customer_email"
            ? `Installation Booking Confirmation - Project No. ${context.projectNumber}`
            : `Project Completion - ${context.projectNumber}`,
        title:
          log.templateKey === "project_booking_customer_email"
            ? "Installation booking confirmation"
            : "Project completion",
        intro: `Dear ${context.customerName},`,
        bodyHtml:
          log.templateKey === "project_booking_customer_email"
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
