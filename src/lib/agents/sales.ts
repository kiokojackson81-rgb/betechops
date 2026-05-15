import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const AGENT_COMMISSION_RATE = 6;

export const agentSaleStatuses = [
  "pending_review",
  "awaiting_payment",
  "payment_confirmed",
  "processing",
  "dispatched",
  "delivered_pending_balance",
  "completed",
  "cancelled",
  "rejected",
] as const;

export const agentSalePaymentTypes = ["transport_fee", "deposit", "full_payment"] as const;
export const agentSaleDeliveryMethods = ["courier", "rider", "shop_pickup", "agent_pickup"] as const;

const agentSaleStatusLabels: Record<(typeof agentSaleStatuses)[number], string> = {
  pending_review: "Pending review",
  awaiting_payment: "Awaiting payment",
  payment_confirmed: "Payment confirmed",
  processing: "Processing",
  dispatched: "Dispatched",
  delivered_pending_balance: "Delivered, pending balance",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const agentSaleStatusNotes: Record<(typeof agentSaleStatuses)[number], string> = {
  pending_review: "Agent submitted the sale and it is waiting for admin review.",
  awaiting_payment: "Admin reviewed the sale and is waiting for customer payment.",
  payment_confirmed: "Payment has been confirmed and the order is waiting for processing.",
  processing: "Betech is preparing the item.",
  dispatched: "The item has been sent out to the customer or pickup point.",
  delivered_pending_balance: "The item was delivered or collected, but there is still a remaining balance.",
  completed: "Customer paid fully and the item was delivered or collected.",
  cancelled: "The sale was cancelled or abandoned.",
  rejected: "The sale was rejected during review.",
};

const agentSaleCreateSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name is required."),
  customerPhone: z.string().trim().min(6, "Customer phone is required."),
  customerLocation: z.string().trim().min(2, "Customer location is required."),
  customerCounty: z.string().trim().optional().nullable(),
  productName: z.string().trim().min(2, "Product name is required."),
  productCategory: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitPrice: z.coerce.number().nonnegative("Unit price cannot be negative."),
  totalAmount: z.coerce.number().positive("Total amount must be greater than zero."),
  paymentType: z.enum(agentSalePaymentTypes),
  amountPaid: z.coerce.number().nonnegative("Amount paid cannot be negative."),
  mpesaReference: z.string().trim().optional().nullable(),
  deliveryMethod: z.enum(agentSaleDeliveryMethods).optional().nullable(),
  deliveryNotes: z.string().trim().optional().nullable(),
  customerNotes: z.string().trim().optional().nullable(),
  internalAgentNotes: z.string().trim().optional().nullable(),
});

const agentSaleStatusUpdateSchema = z.object({
  status: z.enum([
    "pending_review",
    "awaiting_payment",
    "payment_confirmed",
    "processing",
    "dispatched",
    "delivered_pending_balance",
    "cancelled",
    "rejected",
  ]),
});

const agentSaleReceiptSchema = z.object({
  receiptId: z.string().trim().optional().nullable(),
  receiptNumber: z.string().trim().optional().nullable(),
});

function getAgentName(profile: { name?: string | null; email?: string | null } | null | undefined) {
  return profile?.name || profile?.email || "Agent";
}

type AgentSaleRecord = Prisma.AgentSaleGetPayload<{
  include: {
    agent: { select: { id: true; name: true; email: true } };
    receipt: { select: { id: true; receiptNumber: true; order: { select: { orderNumber: true } } } };
  };
}>;

type AgentSaleCommission = Prisma.AgentCommissionGetPayload<{
  select: {
    id: true;
    sourceType: true;
    sourceId: true;
    commissionAmt: true;
    saleAmount: true;
    status: true;
    createdAt: true;
    orderNumber: true;
  };
}>;

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cleanOptional(value: string | null | undefined) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned ? cleaned : null;
}

function normalizeAmount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return roundAmount(Math.max(0, value));
}

function ensureReceiptNumber(sale: AgentSaleRecord) {
  return sale.receiptNumber || sale.receipt?.receiptNumber || sale.receipt?.order?.orderNumber || null;
}

function getCommissionForSale(
  saleId: string,
  commissionsBySaleId: Map<string, AgentSaleCommission>,
) {
  return commissionsBySaleId.get(saleId) ?? null;
}

export function getAgentSaleStatusMeta(status: string) {
  const normalized = String(status || "").toLowerCase() as (typeof agentSaleStatuses)[number];
  return {
    status: normalized,
    label: agentSaleStatusLabels[normalized] ?? status,
    note: agentSaleStatusNotes[normalized] ?? "",
  };
}

export function calculatePotentialCommission(totalAmount: number) {
  return roundAmount(normalizeAmount(totalAmount) * (AGENT_COMMISSION_RATE / 100));
}

export function parseAgentSaleCreateInput(body: unknown) {
  return agentSaleCreateSchema.parse(body);
}

export function parseAgentSaleStatusInput(body: unknown) {
  return agentSaleStatusUpdateSchema.parse(body);
}

export function parseAgentSaleReceiptInput(body: unknown) {
  return agentSaleReceiptSchema.parse(body);
}

async function createAgentActivity(agentId: string, action: string, description: string, tx: Prisma.TransactionClient = prisma) {
  await tx.agentActivityLog.create({
    data: {
      agentId,
      action,
      description,
    },
  });
}

async function fetchSalesCommissions(saleIds: string[]) {
  if (!saleIds.length) return new Map<string, AgentSaleCommission>();
  const rows = await prisma.agentCommission.findMany({
    where: {
      sourceType: "agent_sale",
      sourceId: { in: saleIds },
    },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      commissionAmt: true,
      saleAmount: true,
      status: true,
      createdAt: true,
      orderNumber: true,
    },
  });
  return new Map(rows.filter((row) => row.sourceId).map((row) => [String(row.sourceId), row]));
}

export function presentAgentSale(
  sale: AgentSaleRecord,
  commission: AgentSaleCommission | null,
) {
  const isCompleted = String(sale.status).toLowerCase() === "completed";
  const balance = roundAmount(Math.max(Number(sale.totalAmount ?? 0) - Number(sale.amountPaid ?? 0), 0));
  const derivedCommissionAmount = isCompleted
    ? roundAmount(Number(commission?.commissionAmt ?? sale.potentialCommission ?? calculatePotentialCommission(Number(sale.totalAmount ?? 0))))
    : roundAmount(Number(sale.potentialCommission ?? calculatePotentialCommission(Number(sale.totalAmount ?? 0))));
  const commissionStatus = isCompleted
    ? String(commission?.status || "pending").toLowerCase()
    : "locked";
  const commissionLabel = isCompleted ? "Earned commission" : "Potential commission";
  const commissionBadge = isCompleted
    ? commissionStatus === "paid"
      ? "Paid"
      : commissionStatus === "approved"
        ? "Approved"
        : commissionStatus === "cancelled"
          ? "Cancelled"
          : "Pending payout"
    : "Locked until completed";
  return {
    id: sale.id,
    agentId: sale.agentId,
    agentName: getAgentName(sale.agent),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerLocation: sale.customerLocation,
    customerCounty: sale.customerCounty,
    productName: sale.productName,
    productCategory: sale.productCategory,
    quantity: Number(sale.quantity ?? 0),
    unitPrice: Number(sale.unitPrice ?? 0),
    totalAmount: Number(sale.totalAmount ?? 0),
    amountPaid: Number(sale.amountPaid ?? 0),
    balance,
    paymentType: sale.paymentType,
    mpesaReference: sale.mpesaReference,
    deliveryMethod: sale.deliveryMethod,
    deliveryNotes: sale.deliveryNotes,
    customerNotes: sale.customerNotes,
    internalAgentNotes: sale.internalAgentNotes,
    status: sale.status,
    statusMeta: getAgentSaleStatusMeta(sale.status),
    commissionPct: Number(sale.commissionPct ?? AGENT_COMMISSION_RATE),
    potentialCommission: Number(sale.potentialCommission ?? 0),
    commissionLocked: Boolean(sale.commissionLocked),
    commissionAmount: derivedCommissionAmount,
    commissionStatus,
    commissionLabel,
    commissionBadge,
    commissionExplanation: isCompleted
      ? "Commission has been earned and is now waiting for payout processing."
      : "Commission will be earned after full payment and delivery confirmation.",
    receiptId: sale.receiptId,
    receiptNumber: ensureReceiptNumber(sale),
    completedAt: sale.completedAt,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

export async function createAgentSale(agentId: string, body: unknown) {
  const input = parseAgentSaleCreateInput(body);
  const totalAmount = normalizeAmount(input.totalAmount > 0 ? input.totalAmount : input.quantity * input.unitPrice);
  const amountPaid = normalizeAmount(input.amountPaid);
  const sale = await prisma.agentSale.create({
    data: {
      agentId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerLocation: input.customerLocation,
      customerCounty: cleanOptional(input.customerCounty),
      productName: input.productName,
      productCategory: cleanOptional(input.productCategory),
      quantity: input.quantity,
      unitPrice: normalizeAmount(input.unitPrice),
      totalAmount,
      paymentType: input.paymentType,
      amountPaid,
      mpesaReference: cleanOptional(input.mpesaReference),
      deliveryMethod: cleanOptional(input.deliveryMethod),
      deliveryNotes: cleanOptional(input.deliveryNotes),
      customerNotes: cleanOptional(input.customerNotes),
      internalAgentNotes: cleanOptional(input.internalAgentNotes),
      status: "pending_review",
      commissionPct: AGENT_COMMISSION_RATE,
      potentialCommission: calculatePotentialCommission(totalAmount),
      commissionLocked: true,
    },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
  });

  await createAgentActivity(
    agentId,
    "sale_submitted",
    `Agent sale ${sale.id} submitted for ${sale.customerName} - potential commission locked until completion.`,
  );

  return presentAgentSale(sale, null);
}

export async function getAgentSales(agentId: string) {
  const sales = await prisma.agentSale.findMany({
    where: { agentId },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const commissionBySaleId = await fetchSalesCommissions(sales.map((sale) => sale.id));
  return sales.map((sale) => presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId)));
}

export async function getAgentSaleById(agentId: string, saleId: string) {
  const sale = await prisma.agentSale.findFirst({
    where: { id: saleId, agentId },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
  });
  if (!sale) return null;
  const commissionBySaleId = await fetchSalesCommissions([sale.id]);
  return presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId));
}

export async function getAgentSalesDashboardSummary(agentId: string) {
  const [sales, commissions] = await Promise.all([
    getAgentSales(agentId),
    prisma.agentCommission.findMany({
      where: { agentId, sourceType: "agent_sale" },
      select: { commissionAmt: true, status: true },
    }),
  ]);

  const pendingStatuses = new Set<string>(["pending_review", "awaiting_payment", "payment_confirmed"]);
  const inProgressStatuses = new Set<string>(["processing", "dispatched", "delivered_pending_balance"]);
  const openStatuses = new Set<string>(
    agentSaleStatuses.filter((status) => !["completed", "cancelled", "rejected"].includes(status)),
  );

  const summary = sales.reduce(
    (acc, sale) => {
      acc.totalSubmittedSales += 1;
      if (pendingStatuses.has(String(sale.status))) acc.pendingSales += 1;
      if (inProgressStatuses.has(String(sale.status))) acc.processingSales += 1;
      if (String(sale.status) === "completed") acc.completedSales += 1;
      if (openStatuses.has(String(sale.status))) acc.potentialCommission += Number(sale.potentialCommission ?? 0);
      return acc;
    },
    {
      totalSubmittedSales: 0,
      pendingSales: 0,
      processingSales: 0,
      completedSales: 0,
      potentialCommission: 0,
      earnedCommission: 0,
      paidCommission: 0,
    },
  );

  for (const commission of commissions) {
    const amount = Number(commission.commissionAmt ?? 0);
    const status = String(commission.status || "").toLowerCase();
    if (status === "paid") summary.paidCommission += amount;
    else if (status !== "cancelled") summary.earnedCommission += amount;
  }

  summary.potentialCommission = roundAmount(summary.potentialCommission);
  summary.earnedCommission = roundAmount(summary.earnedCommission);
  summary.paidCommission = roundAmount(summary.paidCommission);

  return { sales, summary };
}

type AdminAgentSalesFilters = {
  q?: string;
  status?: string;
  agentId?: string;
  paymentType?: string;
  start?: string;
  end?: string;
};

export async function getAdminAgentSales(filters: AdminAgentSalesFilters = {}) {
  const where: Prisma.AgentSaleWhereInput = {};
  const and: Prisma.AgentSaleWhereInput[] = [];
  if (filters.status && filters.status !== "all") {
    and.push({ status: filters.status });
  }
  if (filters.agentId && filters.agentId !== "all") {
    and.push({ agentId: filters.agentId });
  }
  if (filters.paymentType && filters.paymentType !== "all") {
    and.push({ paymentType: filters.paymentType });
  }
  if (filters.start || filters.end) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.start) createdAt.gte = new Date(`${filters.start}T00:00:00.000Z`);
    if (filters.end) createdAt.lte = new Date(`${filters.end}T23:59:59.999Z`);
    and.push({ createdAt });
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { customerLocation: { contains: q, mode: "insensitive" } },
        { productName: { contains: q, mode: "insensitive" } },
        { receiptNumber: { contains: q, mode: "insensitive" } },
        { agent: { is: { name: { contains: q, mode: "insensitive" } } } },
        { agent: { is: { email: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const sales = await prisma.agentSale.findMany({
    where,
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  const commissionBySaleId = await fetchSalesCommissions(sales.map((sale) => sale.id));

  return sales.map((sale) => presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId)));
}

export async function getAdminAgentSaleById(saleId: string) {
  const sale = await prisma.agentSale.findUnique({
    where: { id: saleId },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
  });
  if (!sale) return null;
  const commissionBySaleId = await fetchSalesCommissions([sale.id]);
  const activity = await prisma.agentActivityLog.findMany({
    where: {
      agentId: sale.agentId,
      description: {
        contains: sale.id,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    sale: presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId)),
    activity,
  };
}

export async function updateAgentSaleStatus(saleId: string, body: unknown, actorEmail?: string | null) {
  const { status } = parseAgentSaleStatusInput(body);
  const result = await prisma.$transaction(async (tx) => {
    const sale = await tx.agentSale.findUnique({ where: { id: saleId } });
    if (!sale) throw new Error("Agent sale not found.");

    const updated = await tx.agentSale.update({
      where: { id: saleId },
      data: {
        status,
        commissionLocked: true,
      },
      include: {
        agent: { select: { id: true, name: true, email: true } },
        receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
      },
    });

    if (status === "cancelled" || status === "rejected") {
      await tx.agentCommission.updateMany({
        where: {
          agentId: updated.agentId,
          sourceType: "agent_sale",
          sourceId: updated.id,
          NOT: { status: "paid" },
        },
        data: { status: "cancelled" },
      });
    }

    await createAgentActivity(
      updated.agentId,
      `sale_status_${status}`,
      `Agent sale ${updated.id} moved to ${status} by ${actorEmail || "admin"}.`,
      tx,
    );

    return updated;
  });

  const commissionBySaleId = await fetchSalesCommissions([result.id]);
  return presentAgentSale(result, getCommissionForSale(result.id, commissionBySaleId));
}

export function buildAgentSaleReceiptPrefillUrl(sale: {
  id: string;
  agentId: string;
  agentName?: string | null;
  customerName: string;
  customerPhone: string;
  customerLocation?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  paymentType: string;
  deliveryNotes?: string | null;
}) {
  const params = new URLSearchParams({
    agentSaleId: sale.id,
    agentId: sale.agentId,
    agentName: sale.agentName || "",
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerLocation: sale.customerLocation || "",
    productName: sale.productName,
    quantity: String(sale.quantity || 1),
    unitPrice: String(sale.unitPrice || 0),
    totalAmount: String(sale.totalAmount || 0),
    amountPaid: String(sale.amountPaid || 0),
    paymentType: sale.paymentType || "",
    deliveryNotes: sale.deliveryNotes || "",
  });
  return `/receipts?${params.toString()}`;
}

export async function linkAgentSaleReceipt(saleId: string, body: unknown, actorEmail?: string | null) {
  const input = parseAgentSaleReceiptInput(body);
  if (!input.receiptId && !input.receiptNumber) {
    throw new Error("Provide a receipt id or receipt number.");
  }

  const lookup = input.receiptId
    ? await prisma.receipt.findUnique({
        where: { id: input.receiptId },
        select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } },
      })
    : await prisma.receipt.findFirst({
        where: {
          OR: [
            { receiptNumber: input.receiptNumber || undefined },
            { order: { orderNumber: input.receiptNumber || undefined } },
          ],
        },
        select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } },
      });

  if (!lookup) throw new Error("Receipt not found.");

  const sale = await prisma.agentSale.update({
    where: { id: saleId },
    data: {
      receiptId: lookup.id,
      receiptNumber: lookup.receiptNumber || lookup.order?.orderNumber || input.receiptNumber || null,
    },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
  });

  await createAgentActivity(
    sale.agentId,
    "sale_receipt_linked",
    `Agent sale ${sale.id} linked to receipt ${sale.receiptNumber || lookup.id} by ${actorEmail || "admin"}.`,
  );

  const commissionBySaleId = await fetchSalesCommissions([sale.id]);
  return presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId));
}

function canCompleteSale(sale: {
  totalAmount: number;
  amountPaid: number;
  receiptId: string | null;
  status: string;
  deliveryMethod: string | null;
}) {
  const deliveryMethod = String(sale.deliveryMethod || "").toLowerCase();
  const currentStatus = String(sale.status || "").toLowerCase();
  const hasPickupFlow = deliveryMethod === "shop_pickup" || deliveryMethod === "agent_pickup";
  const deliveryConfirmed =
    currentStatus === "delivered_pending_balance" ||
    currentStatus === "dispatched" ||
    hasPickupFlow;
  if (Number(sale.amountPaid ?? 0) < Number(sale.totalAmount ?? 0)) {
    return "Customer payment is not complete yet.";
  }
  if (!deliveryConfirmed) {
    return "Mark the sale as dispatched or delivered before completion.";
  }
  if (!sale.receiptId) {
    return "Link the sale to a receipt before marking it completed.";
  }
  return null;
}

export async function completeAgentSale(saleId: string, actorEmail?: string | null) {
  const completed = await prisma.$transaction(async (tx) => {
    const sale = await tx.agentSale.findUnique({
      where: { id: saleId },
      include: {
        agent: { select: { id: true, name: true, email: true } },
        receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
      },
    });
    if (!sale) throw new Error("Agent sale not found.");

    const validationError = canCompleteSale(sale);
    if (validationError) throw new Error(validationError);

    const existingCommission = await tx.agentCommission.findFirst({
      where: {
        agentId: sale.agentId,
        sourceType: "agent_sale",
        sourceId: sale.id,
      },
    });

    const commissionAmount = calculatePotentialCommission(Number(sale.totalAmount ?? 0));

    if (!existingCommission) {
      await tx.agentCommission.create({
        data: {
          agentId: sale.agentId,
          sourceType: "agent_sale",
          sourceId: sale.id,
          orderNumber: sale.receiptNumber || sale.receipt?.receiptNumber || sale.receipt?.order?.orderNumber || null,
          saleAmount: Number(sale.totalAmount ?? 0),
          commissionPct: Number(sale.commissionPct ?? AGENT_COMMISSION_RATE),
          commissionAmt: commissionAmount,
          status: "pending",
        },
      });
    }

    const updated = await tx.agentSale.update({
      where: { id: sale.id },
      data: {
        status: "completed",
        commissionLocked: false,
        completedAt: sale.completedAt ?? new Date(),
      },
      include: {
        agent: { select: { id: true, name: true, email: true } },
        receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
      },
    });

    await createAgentActivity(
      updated.agentId,
      "sale_completed",
      `Agent sale ${updated.id} marked completed by ${actorEmail || "admin"}.`,
      tx,
    );
    await createAgentActivity(
      updated.agentId,
      "commission_unlocked",
      `Agent sale ${updated.id} unlocked commission of ${commissionAmount}.`,
      tx,
    );

    return updated;
  });

  const commissionBySaleId = await fetchSalesCommissions([completed.id]);
  return presentAgentSale(completed, getCommissionForSale(completed.id, commissionBySaleId));
}
