import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateReceiptSerial, normalizeReceiptSerial } from "@/lib/receipts/serial";

export const AGENT_COMMISSION_RATE = 6;
const AGENT_LEAD_OWNERSHIP_DAYS = 14;
let enterpriseControlsAvailablePromise: Promise<boolean> | null = null;

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
  delivered_pending_balance: "Delivered / collected",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const agentSaleStatusNotes: Record<(typeof agentSaleStatuses)[number], string> = {
  pending_review: "Agent submitted the sale and it is waiting for admin review.",
  awaiting_payment: "Admin reviewed the sale and is waiting for customer payment.",
  payment_confirmed: "Customer payment has been confirmed.",
  processing: "Betech is preparing the item and a receipt has been created.",
  dispatched: "The item has been sent out to the customer or pickup point.",
  delivered_pending_balance: "The item was delivered or collected and is now ready for final completion.",
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
  amountPaid: z.coerce.number().nonnegative("Amount paid cannot be negative.").optional(),
  mpesaReference: z.string().trim().optional().nullable(),
});

const agentSaleReceiptSchema = z.object({
  receiptId: z.string().trim().optional().nullable(),
  receiptNumber: z.string().trim().optional().nullable(),
});

function getAgentName(profile: { name?: string | null; email?: string | null } | null | undefined) {
  return profile?.name || profile?.email || "Agent";
}

function getPrismaErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; column?: unknown; modelName?: unknown } | null;
  };
  return {
    code: String(candidate.code ?? ""),
    message: String(candidate.message ?? ""),
    table: String(candidate.meta?.table ?? ""),
    column: String(candidate.meta?.column ?? ""),
    modelName: String(candidate.meta?.modelName ?? ""),
  };
}

function isAgentSalesSchemaError(error: unknown) {
  const details = getPrismaErrorDetails(error);
  if (!details) return false;
  if (!["P2021", "P2022"].includes(details.code)) return false;
  const haystack = [details.table, details.column, details.modelName, details.message].join(" ");
  return [
    "AgentSale",
    "AgentCommission",
    "AgentLeadOwnership",
    "AgentDuplicateReview",
    "AgentFraudSignal",
    "AgentAuditLog",
    "AgentSaleTimeline",
    "sourceType",
    "sourceId",
    "saleAmount",
    "commissionPct",
    "commissionAmt",
  ].some((token) => haystack.includes(token));
}

function createAgentSaleSetupError() {
  return new Error(
    "Agent sales database setup is incomplete. Apply scripts/sql/20260515_agent_sales_workflow.sql in Neon, then redeploy.",
  );
}

async function hasAgentEnterpriseControls() {
  if (!enterpriseControlsAvailablePromise) {
    enterpriseControlsAvailablePromise = prisma
      .$queryRaw<
        Array<{
          ownership: string | null;
          duplicate_review: string | null;
          fraud_signal: string | null;
          audit_log: string | null;
          timeline: string | null;
        }>
      >`SELECT
          to_regclass('public."AgentLeadOwnership"')::text AS ownership,
          to_regclass('public."AgentDuplicateReview"')::text AS duplicate_review,
          to_regclass('public."AgentFraudSignal"')::text AS fraud_signal,
          to_regclass('public."AgentAuditLog"')::text AS audit_log,
          to_regclass('public."AgentSaleTimeline"')::text AS timeline`
      .then((rows) => {
        const first = rows[0];
        return Boolean(
          first?.ownership &&
            first?.duplicate_review &&
            first?.fraud_signal &&
            first?.audit_log &&
            first?.timeline,
        );
      })
      .catch(() => false);
  }
  return enterpriseControlsAvailablePromise;
}

function emptySalesSummary() {
  return {
    totalSubmittedSales: 0,
    pendingSales: 0,
    processingSales: 0,
    completedSales: 0,
    potentialCommission: 0,
    earnedCommission: 0,
    paidCommission: 0,
  };
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

type AgentPayoutStatusRow = {
  amount: number | null;
  status: string | null;
};

type AgentSaleRecordLite = Prisma.AgentSaleGetPayload<{
  include: {
    agent: { select: { id: true; name: true; email: true } };
    receipt: { select: { id: true; receiptNumber: true; order: { select: { orderNumber: true } } } };
  };
}>;

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cleanOptional(value: string | null | undefined) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned ? cleaned : null;
}

function normalizeCustomerPhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
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

function applyPaidPayoutsToSaleCommissions(
  commissions: AgentSaleCommission[],
  payouts: AgentPayoutStatusRow[],
) {
  let remainingPaid = payouts
    .filter((row) => String(row.status || "").toLowerCase() === "paid")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const paidIds = new Set<string>();
  for (const commission of commissions
    .filter((row) => String(row.status || "").toLowerCase() !== "cancelled")
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const amount = Number(commission.commissionAmt ?? 0);
    if (remainingPaid <= 0) break;
    if (amount <= remainingPaid + 0.0001) {
      paidIds.add(commission.id);
      remainingPaid -= amount;
    }
  }

  return commissions.map((commission) =>
    paidIds.has(commission.id)
      ? {
          ...commission,
          status: "paid",
        }
      : commission,
  );
}

function isAgentSalePodCandidate(sale: {
  totalAmount: number;
  amountPaid: number;
  paymentType?: string | null;
  deliveryMethod?: string | null;
}) {
  const paymentType = String(sale.paymentType || "").toLowerCase();
  const deliveryMethod = String(sale.deliveryMethod || "").toLowerCase();
  if (deliveryMethod === "shop_pickup" || deliveryMethod === "agent_pickup") return false;
  return paymentType === "transport_fee" || paymentType === "deposit";
}

async function generateUniqueAgentReceiptSerial(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const serial = normalizeReceiptSerial(generateReceiptSerial());
    const [order, receipt] = await Promise.all([
      tx.order.findUnique({ where: { orderNumber: serial }, select: { id: true } }),
      tx.receipt.findUnique({ where: { receiptNumber: serial }, select: { id: true } }),
    ]);
    if (!order && !receipt) return serial;
  }
  throw new Error("Unable to generate a unique receipt number for this agent sale.");
}

async function findOrCreateAgentSaleProduct(
  tx: Prisma.TransactionClient,
  sale: Pick<AgentSaleRecordLite, "productName" | "unitPrice">,
) {
  const productName = String(sale.productName || "").trim();
  const unitPrice = normalizeAmount(Number(sale.unitPrice ?? 0));
  const existing = await tx.product.findFirst({
    where: {
      name: {
        equals: productName,
        mode: "insensitive",
      },
    },
  });
  if (existing) return existing;
  return tx.product.create({
    data: {
      sku: `agent-sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: productName || "Agent Sale Product",
      category: "agent_sale",
      sellingPrice: unitPrice,
    },
  });
}

async function syncLinkedReceiptForAgentSale(
  tx: Prisma.TransactionClient,
  sale: Pick<
    AgentSaleRecordLite,
    | "id"
    | "agentId"
    | "customerLocation"
    | "deliveryMethod"
    | "deliveryNotes"
    | "paymentType"
    | "totalAmount"
    | "amountPaid"
    | "status"
    | "receiptId"
    | "receiptNumber"
  >,
  actorEmail?: string | null,
) {
  if (!sale.receiptId) return;
  const receipt = await tx.receipt.findUnique({
    where: { id: sale.receiptId },
    include: { order: true },
  });
  if (!receipt?.order) return;

  const totalAmount = normalizeAmount(Number(sale.totalAmount ?? 0));
  const amountPaid = normalizeAmount(Number(sale.amountPaid ?? 0));
  const isPod = isAgentSalePodCandidate(sale);
  const existingData =
    typeof receipt.data === "object" && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : {};
  const existingPod =
    typeof existingData.podDelivery === "object" && existingData.podDelivery
      ? { ...(existingData.podDelivery as Record<string, unknown>) }
      : null;
  const nextPod = existingPod ?? (isPod ? { status: "pending", createdAt: new Date().toISOString() } : null);

  if (sale.status === "dispatched") {
    if (nextPod) nextPod.dispatchedAt = new Date().toISOString();
  }
  if (sale.status === "delivered_pending_balance") {
    if (nextPod) {
      nextPod.status = "delivered";
      nextPod.deliveredAt = new Date().toISOString();
    }
    existingData.agentSale = {
      ...(typeof existingData.agentSale === "object" && existingData.agentSale ? (existingData.agentSale as Record<string, unknown>) : {}),
      deliveredAt: new Date().toISOString(),
    };
  }
  if (amountPaid >= totalAmount && nextPod && !nextPod.paidAt) {
    nextPod.paidAt = new Date().toISOString();
    if (actorEmail) nextPod.paidBy = actorEmail;
  }

  let orderStatus: "PENDING" | "PROCESSING" | "FULFILLED" | "COMPLETED" | "CANCELED" = "PENDING";
  if (sale.status === "processing") orderStatus = "PROCESSING";
  else if (sale.status === "dispatched" || sale.status === "delivered_pending_balance") orderStatus = "FULFILLED";
  else if (sale.status === "completed") orderStatus = "COMPLETED";
  else if (sale.status === "cancelled" || sale.status === "rejected") orderStatus = "CANCELED";

  const paymentStatus =
    amountPaid >= totalAmount ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID";

  await tx.order.update({
    where: { id: receipt.orderId },
    data: {
      status: orderStatus,
      paidAmount: amountPaid,
      paymentStatus,
      metadata: {
        ...(typeof receipt.order.metadata === "object" && receipt.order.metadata ? (receipt.order.metadata as Record<string, unknown>) : {}),
        customerType: isPod ? "pod" : "online",
        deliveryAddress: sale.customerLocation || null,
        agentSale: {
          saleId: sale.id,
          agentId: sale.agentId,
          paymentType: sale.paymentType,
          deliveryMethod: sale.deliveryMethod,
          commissionAmount: calculatePotentialCommission(totalAmount),
        },
      } as Prisma.InputJsonValue,
    },
  });

  await tx.receipt.update({
    where: { id: receipt.id },
    data: {
      receiptNumber: sale.receiptNumber || receipt.receiptNumber || undefined,
      totals: {
        subtotal: totalAmount,
        tax: 0,
        discount: 0,
        total: totalAmount,
      } as Prisma.InputJsonValue,
      data: {
        ...existingData,
        paymentMethod: "MPESA",
        customerType: isPod ? "pod" : "online",
        paymentType: sale.paymentType,
        deliveryMethod: sale.deliveryMethod,
        customerLocation: sale.customerLocation,
        agentSale: {
          ...(typeof existingData.agentSale === "object" && existingData.agentSale ? (existingData.agentSale as Record<string, unknown>) : {}),
          saleId: sale.id,
          agentId: sale.agentId,
          commissionAmount: calculatePotentialCommission(totalAmount),
        },
        ...(nextPod ? { podDelivery: nextPod } : {}),
      } as Prisma.InputJsonValue,
      notes: cleanOptional(
        [
          "Agent sale receipt",
          sale.deliveryNotes || "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    },
  });
}

async function ensureAgentSaleReceipt(
  tx: Prisma.TransactionClient,
  sale: AgentSaleRecordLite,
) {
  if (sale.receiptId) return sale;

  const activeShop = await tx.shop.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!activeShop?.id) throw new Error("No active shop found for agent sale receipt creation.");

  const totalAmount = normalizeAmount(Number(sale.totalAmount ?? 0));
  const amountPaid = normalizeAmount(Number(sale.amountPaid ?? 0));
  const commissionAmount = calculatePotentialCommission(totalAmount);
  const receiptSerial = await generateUniqueAgentReceiptSerial(tx);
  const product = await findOrCreateAgentSaleProduct(tx, sale);
  const isPod = isAgentSalePodCandidate(sale);

  const order = await tx.order.create({
    data: {
      orderNumber: receiptSerial,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      attendantId: sale.agentId,
      shopId: activeShop.id,
      status: "PROCESSING",
      totalAmount,
      paidAmount: amountPaid,
      paymentStatus: amountPaid >= totalAmount ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID",
      metadata: {
        customerType: isPod ? "pod" : "online",
        deliveryAddress: sale.customerLocation,
        agentSale: {
          saleId: sale.id,
          agentId: sale.agentId,
          commissionAmount,
        },
      } as Prisma.InputJsonValue,
    },
  });

  const createdItem = await tx.orderItem.create({
    data: {
      orderId: order.id,
      productId: product.id,
      quantity: Math.max(1, Math.trunc(Number(sale.quantity ?? 1))),
      sellingPrice: normalizeAmount(Number(sale.unitPrice ?? 0)),
    },
  });

  const unitCost = Number(product.lastBuyingPrice ?? 0);
  if (unitCost > 0) {
    await tx.orderCost.create({
      data: {
        orderItemId: createdItem.id,
        unitCost,
        costSource: "agent_sale_auto_receipt",
      },
    });
  }

  const podDelivery = isPod
    ? {
        status: "pending",
        type: "pay_on_delivery",
        note: sale.deliveryNotes ?? null,
        createdAt: new Date().toISOString(),
        createdById: sale.agentId,
      }
    : undefined;

  const receipt = await tx.receipt.create({
    data: {
      orderId: order.id,
      receiptNumber: receiptSerial,
      docType: "RECEIPT",
      issuedById: sale.agentId,
      taxRate: 0,
      discount: 0,
      showTax: false,
      showDiscount: false,
      paymentDetailsShown: true,
      totals: {
        subtotal: totalAmount,
        tax: 0,
        discount: 0,
        total: totalAmount,
      } as Prisma.InputJsonValue,
      data: {
        paymentMethod: "MPESA",
        customerType: isPod ? "pod" : "online",
        paymentType: sale.paymentType,
        deliveryMethod: sale.deliveryMethod,
        customerLocation: sale.customerLocation,
        agentSale: {
          saleId: sale.id,
          agentId: sale.agentId,
          commissionAmount,
        },
        ...(podDelivery ? { podDelivery } : {}),
      } as Prisma.InputJsonValue,
      notes: cleanOptional(
        [
          "Auto-created from agent sale",
          sale.deliveryNotes || "",
          sale.customerNotes || "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    },
  });

  await createAgentActivity(
    sale.agentId,
    "sale_receipt_created",
    `Agent sale ${sale.id} automatically created receipt ${receipt.receiptNumber || receipt.id}.`,
    tx,
  );
  await createAgentSaleTimelineEntry(
    sale.id,
    "receipt_created",
    `Receipt ${receipt.receiptNumber || receipt.id} created automatically.`,
    null,
    {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber || receiptSerial,
      orderId: order.id,
    } as Prisma.InputJsonValue,
    tx,
  );
  await createAgentAuditLog(
    {
      targetAgentId: sale.agentId,
      saleId: sale.id,
      eventType: "receipt_created",
      summary: `Receipt ${receipt.receiptNumber || receipt.id} auto-created for agent sale ${sale.id}.`,
      metadata: {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber || receiptSerial,
        orderId: order.id,
      } as Prisma.InputJsonValue,
    },
    tx,
  );

  return tx.agentSale.update({
    where: { id: sale.id },
    data: {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber || receiptSerial,
    },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
  });
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

async function createAgentAuditLog(
  args: {
    actorUserId?: string | null;
    targetAgentId?: string | null;
    saleId?: string | null;
    payoutId?: string | null;
    duplicateReviewId?: string | null;
    eventType: string;
    summary: string;
  metadata?: Prisma.InputJsonValue;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  const enabled = await hasAgentEnterpriseControls();
  if (!enabled) return;
  try {
    await tx.agentAuditLog.create({
      data: {
        actorUserId: args.actorUserId || null,
        targetAgentId: args.targetAgentId || null,
        saleId: args.saleId || null,
        payoutId: args.payoutId || null,
        duplicateReviewId: args.duplicateReviewId || null,
        eventType: args.eventType,
        summary: args.summary,
        metadata: args.metadata,
      },
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return;
    throw error;
  }
}

async function createAgentSaleTimelineEntry(
  saleId: string,
  stage: string,
  note: string | null,
  actorUserId?: string | null,
  metadata?: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = prisma,
) {
  const enabled = await hasAgentEnterpriseControls();
  if (!enabled) return;
  try {
    await tx.agentSaleTimeline.create({
      data: {
        saleId,
        stage,
        note,
        actorUserId: actorUserId || null,
        metadata,
      },
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return;
    throw error;
  }
}

async function createAgentFraudSignal(
  args: {
    agentId?: string | null;
    saleId?: string | null;
    signalType: string;
    riskLevel: string;
    title: string;
    description?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  const enabled = await hasAgentEnterpriseControls();
  if (!enabled) return;
  try {
    await tx.agentFraudSignal.create({
      data: {
        agentId: args.agentId || null,
        saleId: args.saleId || null,
        signalType: args.signalType,
        riskLevel: args.riskLevel,
        title: args.title,
        description: args.description || null,
        metadata: args.metadata,
      },
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return;
    throw error;
  }
}

async function syncAgentLeadOwnershipAndReviews(
  tx: Prisma.TransactionClient,
  sale: Pick<
    AgentSaleRecordLite,
    "id" | "agentId" | "customerPhone" | "customerName" | "customerCounty" | "customerLocation" | "productName" | "createdAt"
  >,
) {
  const enabled = await hasAgentEnterpriseControls();
  if (!enabled) return;
  const normalizedPhone = normalizeCustomerPhone(sale.customerPhone);
  if (!normalizedPhone) return;

  const now = new Date();
  await tx.agentLeadOwnership.updateMany({
    where: {
      normalizedPhone,
      status: "active",
      ownedUntil: { lt: now },
    },
    data: {
      status: "expired",
      releasedAt: now,
      overrideNote: "Automatically expired by system.",
    },
  }).catch((error) => {
    if (isAgentSalesSchemaError(error)) return;
    throw error;
  });

  const [activeOwnership, recentPhoneSales, agentProfile] = await Promise.all([
    tx.agentLeadOwnership.findFirst({
      where: {
        normalizedPhone,
        status: "active",
        ownedUntil: { gte: now },
      },
      orderBy: { createdAt: "asc" },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return null;
      throw error;
    }),
    tx.agentSale.findMany({
      where: {
        customerPhone: sale.customerPhone,
        createdAt: { gte: new Date(now.getTime() - AGENT_LEAD_OWNERSHIP_DAYS * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "asc" },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return [];
      throw error;
    }),
    tx.agentProfile.findUnique({
      where: { userId: sale.agentId },
      select: { phone: true, referralCode: true },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return null;
      throw error;
    }),
  ]);

  if (!activeOwnership) {
    try {
      await tx.agentLeadOwnership.create({
        data: {
          normalizedPhone,
          customerName: cleanOptional(sale.customerName),
          customerCounty: cleanOptional(sale.customerCounty),
          customerLocation: cleanOptional(sale.customerLocation),
          productName: cleanOptional(sale.productName),
          agentId: sale.agentId,
          firstSaleId: sale.id,
          status: "active",
          ownedUntil: new Date(now.getTime() + AGENT_LEAD_OWNERSHIP_DAYS * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (!isAgentSalesSchemaError(error)) throw error;
    }
  } else if (activeOwnership.agentId !== sale.agentId) {
    let duplicateReviewId: string | null = null;
    try {
      const existingReview = await tx.agentDuplicateReview.findFirst({
        where: {
          primarySaleId: activeOwnership.firstSaleId,
          duplicateSaleId: sale.id,
        },
        select: { id: true },
      });
      if (!existingReview) {
        const review = await tx.agentDuplicateReview.create({
          data: {
            normalizedPhone,
            primarySaleId: activeOwnership.firstSaleId,
            duplicateSaleId: sale.id,
            primaryAgentId: activeOwnership.agentId,
            duplicateAgentId: sale.agentId,
            status: "open",
          },
          select: { id: true },
        });
        duplicateReviewId = review.id;
      } else {
        duplicateReviewId = existingReview.id;
      }
    } catch (error) {
      if (!isAgentSalesSchemaError(error)) throw error;
    }

    await createAgentFraudSignal(
      {
        agentId: sale.agentId,
        saleId: sale.id,
        signalType: "duplicate_customer",
        riskLevel: "medium",
        title: "Possible duplicate customer",
        description: `Customer phone is already owned by another agent within the ${AGENT_LEAD_OWNERSHIP_DAYS}-day window.`,
        metadata: {
          normalizedPhone,
          ownerAgentId: activeOwnership.agentId,
          firstSaleId: activeOwnership.firstSaleId,
          ownedUntil: activeOwnership.ownedUntil.toISOString(),
        } as Prisma.InputJsonValue,
      },
      tx,
    );
    await createAgentAuditLog(
      {
        targetAgentId: sale.agentId,
        saleId: sale.id,
        duplicateReviewId,
        eventType: "duplicate_customer_detected",
        summary: `Agent sale ${sale.id} triggered duplicate customer review.`,
        metadata: {
          normalizedPhone,
          ownerAgentId: activeOwnership.agentId,
          firstSaleId: activeOwnership.firstSaleId,
        } as Prisma.InputJsonValue,
      },
      tx,
    );
    await createAgentSaleTimelineEntry(
      sale.id,
      "needs_admin_review",
      "Duplicate customer detected. Needs admin ownership review.",
      null,
      {
        normalizedPhone,
        ownerAgentId: activeOwnership.agentId,
        firstSaleId: activeOwnership.firstSaleId,
      } as Prisma.InputJsonValue,
      tx,
    );
  }

  if (recentPhoneSales.length >= 3) {
    await createAgentFraudSignal(
      {
        agentId: sale.agentId,
        saleId: sale.id,
        signalType: "phone_reuse",
        riskLevel: recentPhoneSales.length >= 4 ? "high" : "medium",
        title: "Repeated phone reuse",
        description: `${recentPhoneSales.length} submissions share this customer phone in the recent ownership window.`,
        metadata: {
          normalizedPhone,
          saleIds: recentPhoneSales.map((item) => item.id),
        } as Prisma.InputJsonValue,
      },
      tx,
    );
  }

  if (agentProfile?.phone && normalizeCustomerPhone(agentProfile.phone) === normalizedPhone) {
    await createAgentFraudSignal(
      {
        agentId: sale.agentId,
        saleId: sale.id,
        signalType: "self_submission",
        riskLevel: "high",
        title: "Possible self-submission",
        description: "The customer phone matches the agent profile phone number.",
        metadata: {
          normalizedPhone,
          referralCode: agentProfile.referralCode,
        } as Prisma.InputJsonValue,
      },
      tx,
    );
  }
}

async function fetchSalesCommissions(saleIds: string[]) {
  if (!saleIds.length) return new Map<string, AgentSaleCommission>();
  let rows: AgentSaleCommission[] = [];
  try {
    rows = await prisma.agentCommission.findMany({
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
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return new Map<string, AgentSaleCommission>();
    throw error;
  }
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
  let sale;
  try {
    sale = await prisma.$transaction(async (tx) => {
      const created = await tx.agentSale.create({
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
        `Agent sale ${created.id} submitted for ${created.customerName} - potential commission locked until completion.`,
        tx,
      );
      await createAgentSaleTimelineEntry(
        created.id,
        "submitted",
        "Customer order submitted by agent.",
        agentId,
        undefined,
        tx,
      );
      await createAgentAuditLog(
        {
          actorUserId: agentId,
          targetAgentId: agentId,
          saleId: created.id,
          eventType: "sale_submitted",
          summary: `Agent sale ${created.id} submitted by agent.`,
          metadata: {
            customerPhone: created.customerPhone,
            customerName: created.customerName,
            totalAmount,
          } as Prisma.InputJsonValue,
        },
        tx,
      );
      await syncAgentLeadOwnershipAndReviews(tx, created);
      return created;
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) throw createAgentSaleSetupError();
    throw error;
  }

  return presentAgentSale(sale, null);
}

export async function getAgentSales(agentId: string) {
  let sales: AgentSaleRecord[] = [];
  let payouts: AgentPayoutStatusRow[] = [];
  try {
    [sales, payouts] = await Promise.all([
      prisma.agentSale.findMany({
        where: { agentId },
        include: {
          agent: { select: { id: true, name: true, email: true } },
          receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.agentPayout.findMany({
        where: { agentId },
        select: { amount: true, status: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return [];
    throw error;
  }

  const rawCommissionBySaleId = await fetchSalesCommissions(sales.map((sale) => sale.id));
  const adjustedCommissions = applyPaidPayoutsToSaleCommissions(Array.from(rawCommissionBySaleId.values()), payouts);
  const commissionBySaleId = new Map(
    adjustedCommissions.filter((row) => row.sourceId).map((row) => [String(row.sourceId), row] as const),
  );
  return sales.map((sale) => presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId)));
}

export async function getAgentSaleById(agentId: string, saleId: string) {
  let sale;
  let payouts: AgentPayoutStatusRow[] = [];
  try {
    [sale, payouts] = await Promise.all([
      prisma.agentSale.findFirst({
        where: { id: saleId, agentId },
        include: {
          agent: { select: { id: true, name: true, email: true } },
          receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
        },
      }),
      prisma.agentPayout.findMany({
        where: { agentId },
        select: { amount: true, status: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return null;
    throw error;
  }
  if (!sale) return null;
  const rawCommissionBySaleId = await fetchSalesCommissions([sale.id]);
  const adjustedCommissions = applyPaidPayoutsToSaleCommissions(Array.from(rawCommissionBySaleId.values()), payouts);
  const commissionBySaleId = new Map(
    adjustedCommissions.filter((row) => row.sourceId).map((row) => [String(row.sourceId), row] as const),
  );
  return presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId));
}

export async function getAgentSalesDashboardSummary(agentId: string) {
  const sales = await getAgentSales(agentId);

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
    emptySalesSummary(),
  );

  for (const sale of sales) {
    if (String(sale.status || "").toLowerCase() !== "completed") continue;
    const amount = Number(sale.commissionAmount ?? 0);
    const status = String(sale.commissionStatus || "").toLowerCase();
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
  statuses?: string[];
  agentId?: string;
  paymentType?: string;
  start?: string;
  end?: string;
};

export async function getAdminAgentSales(filters: AdminAgentSalesFilters = {}) {
  const where: Prisma.AgentSaleWhereInput = {};
  const and: Prisma.AgentSaleWhereInput[] = [];
  if (filters.statuses?.length) {
    and.push({ status: { in: filters.statuses } });
  }
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
        { mpesaReference: { contains: q, mode: "insensitive" } },
        { agent: { is: { name: { contains: q, mode: "insensitive" } } } },
        { agent: { is: { email: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  let sales: AgentSaleRecord[] = [];
  try {
    sales = await prisma.agentSale.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, email: true } },
        receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return [];
    throw error;
  }
  const commissionBySaleId = await fetchSalesCommissions(sales.map((sale) => sale.id));
  const presentedSales = sales.map((sale) => presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId)));
  let leadOwnerships: Array<{
    normalizedPhone: string;
    agentId: string;
    firstSaleId: string;
    ownedUntil: Date;
  }> = [];
  let duplicateReviews: Array<{
    primarySaleId: string;
    duplicateSaleId: string;
    status: string;
    resolutionNote: string | null;
  }> = [];
  let fraudSignals: Array<{
    saleId: string | null;
    riskLevel: string;
    title: string;
    description: string | null;
  }> = [];
  const normalizedPhones = Array.from(
    new Set(
      presentedSales
        .map((sale) => normalizeCustomerPhone(sale.customerPhone))
        .filter(Boolean),
    ),
  );
  try {
    [leadOwnerships, duplicateReviews, fraudSignals] = await Promise.all([
      normalizedPhones.length
        ? prisma.agentLeadOwnership.findMany({
            where: {
              normalizedPhone: { in: normalizedPhones },
              status: "active",
            },
            select: { normalizedPhone: true, agentId: true, firstSaleId: true, ownedUntil: true },
          })
        : Promise.resolve([]),
      sales.length
        ? prisma.agentDuplicateReview.findMany({
            where: {
              OR: [
                { primarySaleId: { in: sales.map((sale) => sale.id) } },
                { duplicateSaleId: { in: sales.map((sale) => sale.id) } },
              ],
            },
            select: { primarySaleId: true, duplicateSaleId: true, status: true, resolutionNote: true },
          })
        : Promise.resolve([]),
      sales.length
        ? prisma.agentFraudSignal.findMany({
            where: {
              saleId: { in: sales.map((sale) => sale.id) },
              status: "open",
            },
            select: { saleId: true, riskLevel: true, title: true, description: true },
          })
        : Promise.resolve([]),
    ]);
  } catch (error) {
    if (!isAgentSalesSchemaError(error)) throw error;
  }
  const ownershipByPhone = new Map(leadOwnerships.map((item) => [item.normalizedPhone, item] as const));
  const reviewsBySaleId = new Map<string, typeof duplicateReviews>();
  for (const review of duplicateReviews) {
    const primary = reviewsBySaleId.get(review.primarySaleId) ?? [];
    primary.push(review);
    reviewsBySaleId.set(review.primarySaleId, primary);
    const duplicate = reviewsBySaleId.get(review.duplicateSaleId) ?? [];
    duplicate.push(review);
    reviewsBySaleId.set(review.duplicateSaleId, duplicate);
  }
  const signalBySaleId = new Map<string, (typeof fraudSignals)[number]>();
  for (const signal of fraudSignals) {
    if (!signal.saleId) continue;
    const current = signalBySaleId.get(signal.saleId);
    const currentWeight = current?.riskLevel === "high" ? 3 : current?.riskLevel === "medium" ? 2 : 1;
    const nextWeight = signal.riskLevel === "high" ? 3 : signal.riskLevel === "medium" ? 2 : 1;
    if (!current || nextWeight > currentWeight) signalBySaleId.set(signal.saleId, signal);
  }
  const phoneSubmissions = new Map<string, typeof presentedSales>();

  for (const sale of presentedSales) {
    const phone = String(sale.customerPhone || "").replace(/\D/g, "");
    if (!phone) continue;
    const existing = phoneSubmissions.get(phone) ?? [];
    existing.push(sale);
    phoneSubmissions.set(phone, existing);
  }

  return presentedSales.map((sale) => {
    const phone = String(sale.customerPhone || "").replace(/\D/g, "");
    const related = phone ? phoneSubmissions.get(phone) ?? [] : [];
    const competingAgents = new Set(related.map((item) => item.agentId));
    const duplicateCount = Math.max(0, related.length - 1);
    const hasConflict = competingAgents.size > 1;
    const earliestSubmission = related
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const ownershipUntil = earliestSubmission
      ? new Date(earliestSubmission.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000)
      : null;

    const ownership = phone ? ownershipByPhone.get(phone) : null;
    const reviews = reviewsBySaleId.get(sale.id) ?? [];
    const signal = signalBySaleId.get(sale.id);
    let duplicateRisk: "low" | "medium" | "high" =
      signal?.riskLevel === "high" ? "high" : signal?.riskLevel === "medium" ? "medium" : "low";
    let duplicateNote = signal?.description || "No duplicate indicators detected.";
    if (reviews.length) {
      duplicateRisk = signal?.riskLevel === "high" ? "high" : duplicateCount >= 2 ? "high" : "medium";
      duplicateNote =
        reviews.find((item) => item.status === "open")?.resolutionNote ||
        (ownership && ownership.agentId !== sale.agentId
          ? `Customer already belongs to ${ownership.agentId === earliestSubmission?.agentId ? earliestSubmission?.agentName || "another agent" : "another agent"} within the ownership window.`
          : "Possible duplicate customer needs admin review.");
    } else if (hasConflict && duplicateCount >= 1) {
      duplicateRisk = duplicateCount >= 2 ? "high" : "medium";
      duplicateNote = earliestSubmission?.id === sale.id
        ? "Another agent submitted the same customer after this lead."
        : `Customer already belongs to ${earliestSubmission?.agentName || "another agent"} within the ownership window.`;
    }

    return {
      ...sale,
      duplicateRisk,
      duplicateCount,
      needsReview: reviews.some((item) => item.status === "open") || hasConflict,
      ownershipOwnerAgentName: ownership?.agentId === earliestSubmission?.agentId ? earliestSubmission?.agentName || null : earliestSubmission?.agentName || null,
      ownershipWindowEndsAt: ownership?.ownedUntil || ownershipUntil,
      duplicateNote,
    };
  });
}

export async function getAdminAgentSaleById(saleId: string) {
  let sale;
  try {
    sale = await prisma.agentSale.findUnique({
      where: { id: saleId },
      include: {
        agent: { select: { id: true, name: true, email: true } },
        receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
      },
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) return null;
    throw error;
  }
  if (!sale) return null;
  const commissionBySaleId = await fetchSalesCommissions([sale.id]);
  const [activity, timeline, audit, fraudSignals, duplicateReviews, activeOwnership] = await Promise.all([
    prisma.agentActivityLog.findMany({
      where: {
        agentId: sale.agentId,
        description: {
          contains: sale.id,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agentSaleTimeline
      .findMany({
        where: { saleId: sale.id },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      })
      .catch((error) => {
        if (isAgentSalesSchemaError(error)) return [];
        throw error;
      }),
    prisma.agentAuditLog
      .findMany({
        where: { saleId: sale.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      })
      .catch((error) => {
        if (isAgentSalesSchemaError(error)) return [];
        throw error;
      }),
    prisma.agentFraudSignal
      .findMany({
        where: {
          OR: [{ saleId: sale.id }, { agentId: sale.agentId }],
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
      })
      .catch((error) => {
        if (isAgentSalesSchemaError(error)) return [];
        throw error;
      }),
    prisma.agentDuplicateReview
      .findMany({
        where: {
          OR: [{ primarySaleId: sale.id }, { duplicateSaleId: sale.id }],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          primaryAgent: { select: { id: true, name: true, email: true } },
          duplicateAgent: { select: { id: true, name: true, email: true } },
        },
      })
      .catch((error) => {
        if (isAgentSalesSchemaError(error)) return [];
        throw error;
      }),
    prisma.agentLeadOwnership
      .findFirst({
        where: {
          normalizedPhone: normalizeCustomerPhone(sale.customerPhone),
          status: "active",
          ownedUntil: { gte: new Date() },
        },
        orderBy: { ownedUntil: "desc" },
        include: {
          agent: { select: { id: true, name: true, email: true } },
          firstSale: { select: { id: true, createdAt: true } },
        },
      })
      .catch((error) => {
        if (isAgentSalesSchemaError(error)) return null;
        throw error;
      }),
  ]);

  return {
    sale: presentAgentSale(sale, getCommissionForSale(sale.id, commissionBySaleId)),
    activity,
    timeline,
    audit,
    fraudSignals,
    duplicateReviews,
    activeOwnership,
  };
}

export async function updateAgentSaleStatus(
  saleId: string,
  body: unknown,
  actor?: { userId?: string | null; email?: string | null },
) {
  const { status, amountPaid, mpesaReference } = parseAgentSaleStatusInput(body);
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const sale = await tx.agentSale.findUnique({
        where: { id: saleId },
        include: {
          agent: { select: { id: true, name: true, email: true } },
          receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
        },
      });
      if (!sale) throw new Error("Agent sale not found.");

      const nextAmountPaid =
        typeof amountPaid === "number"
          ? normalizeAmount(amountPaid)
          : normalizeAmount(Number(sale.amountPaid ?? 0));
      if (nextAmountPaid > Number(sale.totalAmount ?? 0)) {
        throw new Error("Amount paid cannot be more than the total amount.");
      }

      let updated = await tx.agentSale.update({
        where: { id: saleId },
        data: {
          status,
          commissionLocked: true,
          ...(typeof amountPaid === "number" ? { amountPaid: nextAmountPaid } : {}),
          ...(mpesaReference !== undefined ? { mpesaReference: cleanOptional(mpesaReference) } : {}),
        },
        include: {
          agent: { select: { id: true, name: true, email: true } },
          receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
        },
      });

      if (status === "processing" && !updated.receiptId) {
        updated = await ensureAgentSaleReceipt(tx, updated);
      }

      await syncLinkedReceiptForAgentSale(tx, updated, actor?.email || null);

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
        `Agent sale ${updated.id} moved to ${status} by ${actor?.email || "admin"}.`,
        tx,
      );
      await createAgentSaleTimelineEntry(
        updated.id,
        status,
        `Sale moved to ${status} by ${actor?.email || "admin"}.`,
        actor?.userId || null,
        {
          amountPaid: nextAmountPaid,
          mpesaReference: mpesaReference !== undefined ? cleanOptional(mpesaReference) : updated.mpesaReference,
        } as Prisma.InputJsonValue,
        tx,
      );
      await createAgentAuditLog(
        {
          actorUserId: actor?.userId || null,
          targetAgentId: updated.agentId,
          saleId: updated.id,
          eventType: `sale_status_${status}`,
          summary: `Agent sale ${updated.id} moved to ${status}.`,
          metadata: {
            actorEmail: actor?.email || null,
            amountPaid: nextAmountPaid,
            mpesaReference: mpesaReference !== undefined ? cleanOptional(mpesaReference) : updated.mpesaReference,
          } as Prisma.InputJsonValue,
        },
        tx,
      );

      return updated;
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) throw createAgentSaleSetupError();
    throw error;
  }

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

export async function linkAgentSaleReceipt(
  saleId: string,
  body: unknown,
  actor?: { userId?: string | null; email?: string | null },
) {
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

  let sale;
  try {
    sale = await prisma.agentSale.update({
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
  } catch (error) {
    if (isAgentSalesSchemaError(error)) throw createAgentSaleSetupError();
    throw error;
  }

  await createAgentActivity(
    sale.agentId,
    "sale_receipt_linked",
    `Agent sale ${sale.id} linked to receipt ${sale.receiptNumber || lookup.id} by ${actor?.email || "admin"}.`,
  );
  await createAgentSaleTimelineEntry(
    sale.id,
    "receipt_linked",
    `Receipt ${sale.receiptNumber || lookup.id} linked by ${actor?.email || "admin"}.`,
    actor?.userId || null,
    {
      receiptId: lookup.id,
      receiptNumber: sale.receiptNumber || lookup.receiptNumber || lookup.order?.orderNumber || null,
    } as Prisma.InputJsonValue,
  );
  await createAgentAuditLog({
    actorUserId: actor?.userId || null,
    targetAgentId: sale.agentId,
    saleId: sale.id,
    eventType: "receipt_linked",
    summary: `Receipt linked to agent sale ${sale.id}.`,
    metadata: {
      actorEmail: actor?.email || null,
      receiptId: lookup.id,
      receiptNumber: sale.receiptNumber || lookup.receiptNumber || lookup.order?.orderNumber || null,
    } as Prisma.InputJsonValue,
  });

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
  const currentStatus = String(sale.status || "").toLowerCase();
  if (Number(sale.amountPaid ?? 0) < Number(sale.totalAmount ?? 0)) {
    return "Customer payment is not complete yet.";
  }
  if (currentStatus !== "delivered_pending_balance") {
    return "Mark the sale as delivered / collected before completion.";
  }
  if (!sale.receiptId) {
    return "Link the sale to a receipt before marking it completed.";
  }
  return null;
}

export async function completeAgentSale(
  saleId: string,
  actor?: { userId?: string | null; email?: string | null },
) {
  let completed;
  try {
    completed = await prisma.$transaction(async (tx) => {
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
            status: "approved",
          },
        });
      } else if (String(existingCommission.status || "").toLowerCase() !== "paid") {
        await tx.agentCommission.update({
          where: { id: existingCommission.id },
          data: {
            orderNumber: sale.receiptNumber || sale.receipt?.receiptNumber || sale.receipt?.order?.orderNumber || existingCommission.orderNumber || null,
            saleAmount: Number(sale.totalAmount ?? 0),
            commissionPct: Number(sale.commissionPct ?? AGENT_COMMISSION_RATE),
            commissionAmt: commissionAmount,
            status: "approved",
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

      await syncLinkedReceiptForAgentSale(tx, updated, actor?.email || null);

      await createAgentActivity(
        updated.agentId,
        "sale_completed",
        `Agent sale ${updated.id} marked completed by ${actor?.email || "admin"}.`,
        tx,
      );
      await createAgentActivity(
        updated.agentId,
        "commission_unlocked",
        `Agent sale ${updated.id} unlocked commission of ${commissionAmount}.`,
        tx,
      );
      await createAgentSaleTimelineEntry(
        updated.id,
        "completed",
        `Sale completed and commission unlocked by ${actor?.email || "admin"}.`,
        actor?.userId || null,
        {
          commissionAmount,
        } as Prisma.InputJsonValue,
        tx,
      );
      await createAgentAuditLog(
        {
          actorUserId: actor?.userId || null,
          targetAgentId: updated.agentId,
          saleId: updated.id,
          eventType: "sale_completed",
          summary: `Agent sale ${updated.id} completed and commission unlocked.`,
          metadata: {
            actorEmail: actor?.email || null,
            commissionAmount,
          } as Prisma.InputJsonValue,
        },
        tx,
      );

      return updated;
    });
  } catch (error) {
    if (isAgentSalesSchemaError(error)) throw createAgentSaleSetupError();
    throw error;
  }

  const commissionBySaleId = await fetchSalesCommissions([completed.id]);
  return presentAgentSale(completed, getCommissionForSale(completed.id, commissionBySaleId));
}
