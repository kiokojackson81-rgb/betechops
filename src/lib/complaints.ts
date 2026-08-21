import "server-only";

import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { getOpsBaseUrl } from "@/lib/runtimeUrls";
import { getCustomerAccountOrderDetail, type CustomerAccountIdentity } from "@/lib/shopCustomerOrders";

export const COMPLAINT_CATEGORIES = [
  "PRODUCT_NOT_WORKING",
  "INSTALLATION_ISSUE",
  "DELIVERY_ISSUE",
  "PAYMENT_OR_RECEIPT",
  "WARRANTY_CLAIM",
  "SOLAR_PERFORMANCE",
  "WRONG_OR_MISSING_ITEM",
  "CUSTOMER_SERVICE",
  "OTHER",
] as const;
export const COMPLAINT_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "CUSTOMER_CONTACTED",
  "WAITING_FOR_CUSTOMER",
  "TECHNICAL_REVIEW",
  "SITE_VISIT_REQUIRED",
  "WARRANTY_REVIEW",
  "RESOLVED",
  "CLOSED",
] as const;
export const COMPLAINT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const COMPLAINT_SYSTEM_STATUSES = ["NOT_WORKING", "INTERMITTENT", "DEGRADED", "UNKNOWN"] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number];

export const complaintCategoryLabels: Record<ComplaintCategory, string> = {
  PRODUCT_NOT_WORKING: "Product not working",
  INSTALLATION_ISSUE: "Installation issue",
  DELIVERY_ISSUE: "Delivery issue",
  PAYMENT_OR_RECEIPT: "Payment or receipt",
  WARRANTY_CLAIM: "Warranty claim",
  SOLAR_PERFORMANCE: "Solar performance",
  WRONG_OR_MISSING_ITEM: "Wrong or missing item",
  CUSTOMER_SERVICE: "Customer service",
  OTHER: "Other",
};

const detailInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  order: { select: { id: true, orderNumber: true } },
  receipt: { select: { id: true, receiptNumber: true } },
  websiteOrder: { select: { id: true, orderRef: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  activities: {
    orderBy: { createdAt: "desc" as const },
    include: { actorUser: { select: { id: true, name: true, email: true } } },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.ComplaintInclude;

export type ComplaintDetail = Prisma.ComplaintGetPayload<{ include: typeof detailInclude }>;

export function complaintStaffAccess(user: { role?: string | null; attendantCategory?: string | null }) {
  if (user.role === "ADMIN" || user.role === "SUPERVISOR") return true;
  return user.role === "ATTENDANT" && user.attendantCategory === "SUPPORT_OPS";
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\u0000/g, "").slice(0, maxLength);
}

export function validateComplaintInput(input: Record<string, unknown>) {
  const category = cleanText(input.category, 64) as ComplaintCategory;
  const title = cleanText(input.title, 140);
  const description = cleanText(input.description, 5000);
  const systemStatus = cleanText(input.systemStatus, 64);
  const errorCode = cleanText(input.errorCode, 120);
  const relatedRecordId = cleanText(input.relatedRecordId, 180);
  const problemStarted = cleanText(input.problemStartedAt, 64);
  if (!COMPLAINT_CATEGORIES.includes(category)) throw new Error("Select a valid issue category.");
  if (title.length < 5) throw new Error("Enter a clear issue title of at least 5 characters.");
  if (description.length < 20) throw new Error("Describe the issue in at least 20 characters.");
  if (systemStatus && !COMPLAINT_SYSTEM_STATUSES.includes(systemStatus as (typeof COMPLAINT_SYSTEM_STATUSES)[number])) {
    throw new Error("Select a valid current system status.");
  }
  const problemStartedAt = problemStarted ? new Date(problemStarted) : null;
  if (problemStartedAt && Number.isNaN(problemStartedAt.getTime())) throw new Error("Enter a valid problem start date.");
  return { category, title, description, systemStatus: systemStatus || null, errorCode: errorCode || null, relatedRecordId: relatedRecordId || null, problemStartedAt };
}

async function uniqueComplaintReference() {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = `CMP-${year}-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
    if (!(await prisma.complaint.findUnique({ where: { reference }, select: { id: true } }))) return reference;
  }
  throw new Error("Could not allocate a complaint reference. Please try again.");
}

async function notifyComplaintQueue(input: { id: string; reference: string; title: string; category: string }) {
  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { not: null },
      OR: [{ role: { in: ["ADMIN", "SUPERVISOR"] } }, { attendantCategory: "SUPPORT_OPS" }],
    },
    select: { email: true },
  });
  const emails = Array.from(new Set(recipients.map((row) => row.email?.trim().toLowerCase()).filter((value): value is string => Boolean(value))));
  if (!emails.length) return;
  try {
    await sendGeneralCustomerNotificationEmail({
      to: emails,
      subject: `New complaint ${input.reference}: ${input.title}`,
      title: "New customer complaint",
      intro: "A new customer case is waiting in the Complaints & Issues queue.",
      bodyHtml: `<p><strong>Reference:</strong> ${input.reference}</p><p><strong>Category:</strong> ${input.category.replace(/_/g, " ")}</p><p><strong>Issue:</strong> ${input.title.replace(/[<>&]/g, "")}</p>`,
      bodyText: `${input.reference} - ${input.category.replace(/_/g, " ")} - ${input.title}`,
      ctaLabel: "Open complaint",
      ctaUrl: `${getOpsBaseUrl()}/admin/complaints/${encodeURIComponent(input.reference)}`,
    });
    await prisma.complaintActivity.create({ data: { complaintId: input.id, actorType: "SYSTEM", eventType: "EMAIL_NOTIFICATION_SENT", summary: `New-case email sent to ${emails.length} support recipient(s).` } });
  } catch (error) {
    await prisma.complaintActivity.create({ data: { complaintId: input.id, actorType: "SYSTEM", eventType: "EMAIL_NOTIFICATION_FAILED", summary: "Support email delivery failed; the case remains visible in the operations queue.", newData: { error: error instanceof Error ? error.message.slice(0, 500) : "Unknown email error" } } }).catch(() => undefined);
  }
}

async function resolveOwnedRecord(identity: CustomerAccountIdentity, routeId: string | null) {
  if (!routeId) return { orderId: null, receiptId: null, websiteOrderId: null, relatedReference: null };
  const detail = await getCustomerAccountOrderDetail({ ...identity, routeId });
  if (!detail) throw new Error("The selected order or receipt is not linked to your account.");
  if (routeId.startsWith("website-")) {
    return { orderId: null, receiptId: detail.receiptId, websiteOrderId: routeId.slice(8), relatedReference: detail.orderRef };
  }
  const receiptId = detail.receiptId || routeId.slice(8);
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, select: { orderId: true } });
  return { orderId: receipt?.orderId || null, receiptId, websiteOrderId: null, relatedReference: detail.orderRef };
}

export async function createCustomerComplaint(args: {
  identity: CustomerAccountIdentity;
  input: Record<string, unknown>;
  forceDuplicate?: boolean;
}) {
  const data = validateComplaintInput(args.input);
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentCount = await prisma.complaint.count({ where: { customerId: args.identity.userId, createdAt: { gte: tenMinutesAgo } } });
  if (recentCount >= 3) throw new Error("Too many cases were submitted recently. Please wait a few minutes and try again.");
  const related = await resolveOwnedRecord(args.identity, data.relatedRecordId);
  const duplicate = await prisma.complaint.findFirst({
    where: {
      customerId: args.identity.userId,
      category: data.category,
      status: { notIn: ["RESOLVED", "CLOSED"] },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      ...(related.relatedReference ? { relatedReference: related.relatedReference } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { reference: true, title: true, status: true, createdAt: true },
  });
  if (duplicate && !args.forceDuplicate) return { duplicate } as const;
  const reference = await uniqueComplaintReference();
  const complaint = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: {
        reference,
        customerId: args.identity.userId,
        category: data.category,
        title: data.title,
        description: data.description,
        problemStartedAt: data.problemStartedAt,
        systemStatus: data.systemStatus,
        errorCode: data.errorCode,
        ...related,
      },
    });
    await tx.complaintActivity.createMany({ data: [
      { complaintId: created.id, actorUserId: args.identity.userId, actorType: "CUSTOMER", eventType: "CREATED", summary: "Customer submitted the complaint." },
      { complaintId: created.id, actorType: "SYSTEM", eventType: "SUPPORT_QUEUE_NOTIFIED", summary: "Admin and Support Operations queues were notified." },
    ] });
    return created;
  });
  await notifyComplaintQueue(complaint);
  return { complaint } as const;
}

export async function listCustomerComplaints(customerId: string) {
  return prisma.complaint.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, include: { assignedTo: { select: { name: true } }, _count: { select: { messages: true, attachments: true } } } });
}

export async function getCustomerComplaint(reference: string, customerId: string) {
  const complaint = await prisma.complaint.findFirst({ where: { reference, customerId }, include: detailInclude });
  if (!complaint) return null;
  return { ...complaint, messages: complaint.messages.filter((message) => message.visibility === "CUSTOMER") };
}

export async function getStaffComplaint(reference: string) {
  return prisma.complaint.findUnique({ where: { reference }, include: detailInclude });
}

export async function addComplaintMessage(args: { reference: string; authorUserId: string; message: unknown; visibility: "CUSTOMER" | "INTERNAL"; customerId?: string }) {
  const message = cleanText(args.message, 4000);
  if (message.length < 2) throw new Error("Enter a message before sending.");
  const complaint = await prisma.complaint.findFirst({ where: { reference: args.reference, ...(args.customerId ? { customerId: args.customerId } : {}) }, select: { id: true } });
  if (!complaint) throw new Error("Complaint not found.");
  return prisma.$transaction(async (tx) => {
    const created = await tx.complaintMessage.create({ data: { complaintId: complaint.id, authorUserId: args.authorUserId, visibility: args.visibility, message } });
    await tx.complaintActivity.create({ data: { complaintId: complaint.id, actorUserId: args.authorUserId, actorType: args.customerId ? "CUSTOMER" : "STAFF", eventType: args.visibility === "INTERNAL" ? "INTERNAL_NOTE_ADDED" : "MESSAGE_SENT", summary: args.visibility === "INTERNAL" ? "Staff added an internal note." : "A customer-visible message was added." } });
    return created;
  });
}

export async function updateComplaintByStaff(args: { reference: string; actorUserId: string; input: Record<string, unknown> }) {
  const existing = await prisma.complaint.findUnique({ where: { reference: args.reference } });
  if (!existing) throw new Error("Complaint not found.");
  const status = cleanText(args.input.status, 64) as ComplaintStatus;
  const priority = cleanText(args.input.priority, 32) as ComplaintPriority;
  if (status && !COMPLAINT_STATUSES.includes(status)) throw new Error("Invalid complaint status.");
  if (priority && !COMPLAINT_PRIORITIES.includes(priority)) throw new Error("Invalid priority.");
  const assignedToId = cleanText(args.input.assignedToId, 64) || null;
  if (assignedToId && !(await prisma.user.findFirst({ where: { id: assignedToId, isActive: true }, select: { id: true } }))) throw new Error("Selected assignee is unavailable.");
  const data = {
    status: status || existing.status,
    priority: priority || existing.priority,
    assignedToId,
    technicalFindings: cleanText(args.input.technicalFindings, 6000) || null,
    warrantyFindings: cleanText(args.input.warrantyFindings, 6000) || null,
    siteVisitInfo: cleanText(args.input.siteVisitInfo, 3000) || null,
    resolution: cleanText(args.input.resolution, 6000) || null,
    resolvedAt: status === "RESOLVED" && existing.status !== "RESOLVED" ? new Date() : status && status !== "RESOLVED" && status !== "CLOSED" ? null : existing.resolvedAt,
    closedAt: status === "CLOSED" && existing.status !== "CLOSED" ? new Date() : status && status !== "CLOSED" ? null : existing.closedAt,
  };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.complaint.update({ where: { id: existing.id }, data });
    await tx.complaintActivity.create({ data: { complaintId: existing.id, actorUserId: args.actorUserId, actorType: "STAFF", eventType: "CASE_UPDATED", summary: `Case updated: ${updated.status.replace(/_/g, " ")}.`, previousData: { status: existing.status, priority: existing.priority, assignedToId: existing.assignedToId }, newData: { status: updated.status, priority: updated.priority, assignedToId: updated.assignedToId } } });
    return updated;
  });
}

export async function listAdminComplaints(filters: { status?: string; priority?: string; query?: string }) {
  const query = cleanText(filters.query, 120);
  return prisma.complaint.findMany({
    where: {
      ...(filters.status && COMPLAINT_STATUSES.includes(filters.status as ComplaintStatus) ? { status: filters.status } : {}),
      ...(filters.priority && COMPLAINT_PRIORITIES.includes(filters.priority as ComplaintPriority) ? { priority: filters.priority } : {}),
      ...(query ? { OR: [{ reference: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }, { customer: { name: { contains: query, mode: "insensitive" } } }, { customer: { phone: { contains: query } } }] } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { customer: { select: { id: true, name: true, phone: true, email: true } }, assignedTo: { select: { id: true, name: true } }, _count: { select: { attachments: true, messages: true } } },
  });
}

export async function complaintDashboardCounts() {
  const rows = await prisma.complaint.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}
