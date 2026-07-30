import { WebsiteOrderStatus, WebsiteOrderType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WEBSITE_ORDER_SCHEMA_SQL = [
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebsiteOrderStatus') THEN
      CREATE TYPE "WebsiteOrderStatus" AS ENUM (
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'RECEIPT_ISSUED',
        'DISPATCHED',
        'PAYMENT_CONFIRMED',
        'DELIVERED',
        'CANCELLED'
      );
    END IF;
  END $$`,
  `ALTER TYPE "WebsiteOrderStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED'`,
  `ALTER TYPE "WebsiteOrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_CONFIRMED'`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebsiteOrderType') THEN
      CREATE TYPE "WebsiteOrderType" AS ENUM (
        'POD',
        'PREPAID',
        'SHOP_PICKUP',
        'QUOTE_FIRST'
      );
    END IF;
  END $$`,
  `CREATE TABLE IF NOT EXISTS "WebsiteOrder" (
    "id" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "customerUserId" TEXT,
    "referredByAgentId" TEXT,
    "attributionCodeUsed" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerLocation" TEXT NOT NULL,
    "customerEmail" TEXT,
    "deliveryMethod" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "orderType" "WebsiteOrderType" NOT NULL,
    "status" "WebsiteOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "deliveryFee" DECIMAL(12,2),
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEBSITE',
    "receiptId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteOrder_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "WebsiteOrderItem" (
    "id" TEXT NOT NULL,
    "websiteOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteOrderItem_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "WebsiteOrder" ADD COLUMN IF NOT EXISTS "customerUserId" TEXT`,
  `ALTER TABLE "WebsiteOrder" ADD COLUMN IF NOT EXISTS "referredByAgentId" TEXT`,
  `ALTER TABLE "WebsiteOrder" ADD COLUMN IF NOT EXISTS "attributionCodeUsed" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteOrder_orderRef_key" ON "WebsiteOrder"("orderRef")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteOrder_receiptId_key" ON "WebsiteOrder"("receiptId")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrder_status_createdAt_idx" ON "WebsiteOrder"("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrder_orderType_createdAt_idx" ON "WebsiteOrder"("orderType", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrder_customerUserId_createdAt_idx" ON "WebsiteOrder"("customerUserId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrder_referredByAgentId_createdAt_idx" ON "WebsiteOrder"("referredByAgentId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrderItem_websiteOrderId_idx" ON "WebsiteOrderItem"("websiteOrderId")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrderItem_productId_idx" ON "WebsiteOrderItem"("productId")`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'WebsiteOrder_confirmedById_fkey'
        AND table_name = 'WebsiteOrder'
    ) THEN
      ALTER TABLE "WebsiteOrder"
        ADD CONSTRAINT "WebsiteOrder_confirmedById_fkey"
        FOREIGN KEY ("confirmedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'WebsiteOrder_customerUserId_fkey'
        AND table_name = 'WebsiteOrder'
    ) THEN
      ALTER TABLE "WebsiteOrder"
        ADD CONSTRAINT "WebsiteOrder_customerUserId_fkey"
        FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'WebsiteOrder_receiptId_fkey'
        AND table_name = 'WebsiteOrder'
    ) THEN
      ALTER TABLE "WebsiteOrder"
        ADD CONSTRAINT "WebsiteOrder_receiptId_fkey"
        FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'WebsiteOrderItem_websiteOrderId_fkey'
        AND table_name = 'WebsiteOrderItem'
    ) THEN
      ALTER TABLE "WebsiteOrderItem"
        ADD CONSTRAINT "WebsiteOrderItem_websiteOrderId_fkey"
        FOREIGN KEY ("websiteOrderId") REFERENCES "WebsiteOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'WebsiteOrderItem_productId_fkey'
        AND table_name = 'WebsiteOrderItem'
    ) THEN
      ALTER TABLE "WebsiteOrderItem"
        ADD CONSTRAINT "WebsiteOrderItem_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
] as const;

export const websiteOrderCreateSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().trim().min(1),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(7),
  customerEmail: z.string().trim().email().optional().or(z.literal("")),
  customerLocation: z.string().trim().min(2),
  deliveryMethod: z.string().trim().min(2),
  paymentMethod: z.string().trim().min(2),
  notes: z.string().trim().max(4000).optional(),
});

export type WebsiteOrderCreateInput = z.infer<typeof websiteOrderCreateSchema>;

const globalWebsiteOrderSchema = globalThis as typeof globalThis & {
  __websiteOrderSchemaReady?: Promise<void>;
};

export type WebsiteOrderListRow = Prisma.WebsiteOrderGetPayload<{
  include: {
    items: true;
    receipt: {
      select: {
        id: true;
        receiptNumber: true;
        generatedAt: true;
      };
    };
    confirmedBy: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    customerUser: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        referredByAgentId: true;
        attributionCodeUsed: true;
      };
    };
  };
}>;

export const websiteOrderAdminInclude = {
  items: true,
  receipt: {
    select: {
      id: true,
      receiptNumber: true,
      generatedAt: true,
    },
  },
  confirmedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  customerUser: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      referredByAgentId: true,
      attributionCodeUsed: true,
    },
  },
} satisfies Prisma.WebsiteOrderInclude;

export function deriveWebsiteOrderType(deliveryMethod: string, paymentMethod: string) {
  const delivery = deliveryMethod.toLowerCase();
  const payment = paymentMethod.toLowerCase();
  if (delivery.includes("pickup")) return WebsiteOrderType.SHOP_PICKUP;
  if (payment.includes("quote")) return WebsiteOrderType.QUOTE_FIRST;
  if (payment.includes("pay on delivery") || payment.includes("pod")) return WebsiteOrderType.POD;
  return WebsiteOrderType.PREPAID;
}

export function isWebsiteOrderPod(orderType: WebsiteOrderType, paymentMethod: string) {
  return orderType === WebsiteOrderType.POD || paymentMethod.toLowerCase().includes("pay on delivery") || paymentMethod.toLowerCase().includes("pod");
}

export function buildWebsiteOrderRef() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BT-WEB-${stamp}-${random}`;
}

export function toNumberValue(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return null;
  const numeric = typeof value === "object" && "toNumber" in value ? value.toNumber() : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export type SerializedWebsiteOrder = {
  id: string;
  orderRef: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerEmail: string | null;
  referredByAgentId: string | null;
  attributionCodeUsed: string | null;
  referredByAgent: {
    id: string;
    name: string;
    email: string | null;
    referralCode: string | null;
  } | null;
  deliveryMethod: string;
  paymentMethod: string;
  orderType: WebsiteOrderType;
  status: WebsiteOrderStatus;
  subtotal: number;
  deliveryFee: number | null;
  total: number;
  notes: string | null;
  source: string;
  receiptId: string | null;
  receipt: {
    id: string;
    receiptNumber: string | null;
    generatedAt: string;
  } | null;
  confirmedAt: string | null;
  confirmedBy: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  assignedAttendant: {
    id: string | null;
    name: string;
    email: string | null;
  } | null;
  cancelledAt: string | null;
  processingAt: string | null;
  receiptIssuedAt: string | null;
  dispatchedAt: string | null;
  paymentConfirmedAt: string | null;
  paymentConfirmationMethod: string | null;
  paymentConfirmationReference: string | null;
  deliveredAt: string | null;
  receiptFlowMode: "pod" | "normal" | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku: string | null;
    category: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type WebsiteOrderReferralAgentSummary = {
  id: string;
  name: string;
  email: string | null;
  referralCode: string | null;
};

const WEBSITE_ORDER_STAFF_EMAILS = ["jeniffer@betech.co.ke", "brendah@betech.co.ke"] as const;

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function isWebsiteOrdersStaffEmail(email: unknown) {
  return WEBSITE_ORDER_STAFF_EMAILS.includes(normalizeEmail(email) as (typeof WEBSITE_ORDER_STAFF_EMAILS)[number]);
}

function readWebsiteOrderAssignment(metadata: unknown) {
  const base = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const assignedAttendantId =
    typeof base.assignedAttendantId === "string" && base.assignedAttendantId.trim()
      ? base.assignedAttendantId.trim()
      : null;
  const assignedAttendantEmail =
    typeof base.assignedAttendantEmail === "string" && base.assignedAttendantEmail.trim()
      ? base.assignedAttendantEmail.trim().toLowerCase()
      : null;
  const assignedAttendantName =
    typeof base.assignedAttendantName === "string" && base.assignedAttendantName.trim()
      ? base.assignedAttendantName.trim()
      : null;

  if (!assignedAttendantId && !assignedAttendantEmail && !assignedAttendantName) return null;
  return {
    id: assignedAttendantId,
    email: assignedAttendantEmail,
    name: assignedAttendantName,
  };
}

function readWebsiteOrderMetadata(metadata: unknown) {
  const base = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const readString = (key: string) => {
    const value = base[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  const receiptFlowModeRaw = readString("receiptFlowMode");
  return {
    processingAt: readString("processingAt"),
    receiptIssuedAt: readString("receiptIssuedAt"),
    dispatchedAt: readString("dispatchedAt"),
    paymentConfirmedAt: readString("paymentConfirmedAt"),
    paymentConfirmationMethod: readString("paymentConfirmationMethod"),
    paymentConfirmationReference: readString("paymentConfirmationReference"),
    deliveredAt: readString("deliveredAt"),
    receiptFlowMode: receiptFlowModeRaw === "pod" || receiptFlowModeRaw === "normal" ? receiptFlowModeRaw : null,
  } as const;
}

async function buildWebsiteOrderReferralAgentMap(orders: WebsiteOrderListRow[]) {
  const agentIds = Array.from(
    new Set(
      orders
        .flatMap((order) => [order.referredByAgentId, order.customerUser?.referredByAgentId])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  if (!agentIds.length) {
    return new Map<string, WebsiteOrderReferralAgentSummary>();
  }

  const users = await prisma.user.findMany({
    where: { id: { in: agentIds } },
    select: {
      id: true,
      name: true,
      email: true,
      agentProfile: {
        select: {
          referralCode: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return new Map<string, WebsiteOrderReferralAgentSummary>(
    users.map((user) => {
      const profileName = [user.agentProfile?.firstName, user.agentProfile?.lastName].filter(Boolean).join(" ").trim();
      return [
        user.id,
        {
          id: user.id,
          name: profileName || user.name || user.email || "Agent",
          email: user.email ?? null,
          referralCode: user.agentProfile?.referralCode ?? null,
        },
      ];
    }),
  );
}

function serializeWebsiteOrderRow(
  order: WebsiteOrderListRow,
  referralAgentsById: Map<string, WebsiteOrderReferralAgentSummary>,
) {
  const subtotal = toNumberValue(order.subtotal) ?? 0;
  const deliveryFee = toNumberValue(order.deliveryFee);
  const total = toNumberValue(order.total) ?? 0;
  const metadata = order.metadata ?? null;
  const lifecycle = readWebsiteOrderMetadata(metadata);
  const referredByAgentId = order.referredByAgentId || order.customerUser?.referredByAgentId || null;
  const attributionCodeUsed = order.attributionCodeUsed || order.customerUser?.attributionCodeUsed || null;

  return {
    id: order.id,
    orderRef: order.orderRef,
    customerUserId: order.customerUserId || order.customerUser?.id || null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerLocation: order.customerLocation,
    customerEmail: order.customerEmail,
    referredByAgentId,
    attributionCodeUsed,
    referredByAgent: referredByAgentId ? referralAgentsById.get(referredByAgentId) ?? null : null,
    deliveryMethod: order.deliveryMethod,
    paymentMethod: order.paymentMethod,
    orderType: order.orderType,
    status: order.status,
    subtotal,
    deliveryFee,
    total,
    notes: order.notes,
    source: order.source,
    receiptId: order.receiptId,
    receipt: order.receipt
      ? {
          id: order.receipt.id,
          receiptNumber: order.receipt.receiptNumber,
          generatedAt: order.receipt.generatedAt.toISOString(),
        }
      : null,
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    confirmedBy: order.confirmedBy
      ? {
          id: order.confirmedBy.id,
          name: order.confirmedBy.name ?? order.confirmedBy.email ?? "User",
          email: order.confirmedBy.email ?? null,
        }
      : null,
    assignedAttendant: (() => {
      const assigned = readWebsiteOrderAssignment(metadata);
      return assigned
        ? {
            id: assigned.id,
            name: assigned.name ?? assigned.email ?? "Assigned staff",
            email: assigned.email ?? null,
          }
        : null;
    })(),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    processingAt: lifecycle.processingAt,
    receiptIssuedAt: lifecycle.receiptIssuedAt,
    dispatchedAt: lifecycle.dispatchedAt,
    paymentConfirmedAt: lifecycle.paymentConfirmedAt,
    paymentConfirmationMethod: lifecycle.paymentConfirmationMethod,
    paymentConfirmationReference: lifecycle.paymentConfirmationReference,
    deliveredAt: lifecycle.deliveredAt,
    receiptFlowMode: lifecycle.receiptFlowMode,
    metadata,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: toNumberValue(item.unitPrice) ?? 0,
      total: toNumberValue(item.total) ?? 0,
      sku: item.sku,
      category: item.category,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  } satisfies SerializedWebsiteOrder;
}

export async function serializeWebsiteOrders(orders: WebsiteOrderListRow[]) {
  const referralAgentsById = await buildWebsiteOrderReferralAgentMap(orders);
  return orders.map((order) => serializeWebsiteOrderRow(order, referralAgentsById));
}

export async function serializeWebsiteOrder(order: WebsiteOrderListRow) {
  const [serialized] = await serializeWebsiteOrders([order]);
  return serialized;
}

export function buildWebsiteOrderReceiptPrefill(order: SerializedWebsiteOrder, mode: "pod" | "normal") {
  const isPickup = order.orderType === WebsiteOrderType.SHOP_PICKUP || order.deliveryMethod.toLowerCase().includes("pickup");
  const customerType = mode === "pod" ? "pod" : isPickup ? "online" : "delivery";
  const paymentMethod =
    order.paymentConfirmationMethod?.toUpperCase() === "MPESA"
      ? "MPESA"
      : order.paymentConfirmationMethod?.toUpperCase() === "CASH"
        ? "CASH"
        : mode === "pod"
          ? "CASH"
          : "MPESA";
  const notes = [
    `Website order ref: ${order.orderRef}`,
    `Website payment option: ${order.paymentMethod}`,
    order.paymentConfirmationMethod ? `Website payment confirmed: ${order.paymentConfirmationMethod}${order.paymentConfirmationReference ? ` (${order.paymentConfirmationReference})` : ""}` : "",
    `Website delivery method: ${order.deliveryMethod}`,
    order.notes || "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    websiteOrderId: order.id,
    websiteOrderRef: order.orderRef,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail || "",
    deliveryAddress: order.customerLocation,
    customerType,
    deliveryStatus: customerType === "delivery" ? "pending" : undefined,
    paymentMethod,
    notes,
    podDelivery: mode === "pod" ? { note: `Website POD order ${order.orderRef}` } : undefined,
    metadata: {
      source: "WEBSITE",
      websiteOrderId: order.id,
      websiteOrderRef: order.orderRef,
      websiteOrderType: order.orderType,
      websitePaymentMethod: order.paymentMethod,
      websiteDeliveryMethod: order.deliveryMethod,
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      title: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sku: item.sku,
    })),
  };
}

export const WEBSITE_ORDER_LIFECYCLE: WebsiteOrderStatus[] = [
  WebsiteOrderStatus.PENDING,
  WebsiteOrderStatus.PROCESSING,
  WebsiteOrderStatus.RECEIPT_ISSUED,
  WebsiteOrderStatus.DISPATCHED,
  WebsiteOrderStatus.PAYMENT_CONFIRMED,
  WebsiteOrderStatus.DELIVERED,
] as const;

export function canAdvanceWebsiteOrderStatus(current: WebsiteOrderStatus, next: WebsiteOrderStatus) {
  if (current === next) {
    return {
      ok: false as const,
      error: `Website order is already ${next.replace(/_/g, " ").toLowerCase()}.`,
    };
  }

  if (next === WebsiteOrderStatus.CANCELLED) {
    if (current === WebsiteOrderStatus.DELIVERED || current === WebsiteOrderStatus.CANCELLED) {
      return {
        ok: false as const,
        error: "Delivered or cancelled website orders cannot be cancelled again.",
      };
    }
    return { ok: true as const };
  }

  const allowedTransitions: Partial<Record<WebsiteOrderStatus, WebsiteOrderStatus[]>> = {
    [WebsiteOrderStatus.PENDING]: [WebsiteOrderStatus.PROCESSING],
    [WebsiteOrderStatus.CONFIRMED]: [WebsiteOrderStatus.PROCESSING],
    [WebsiteOrderStatus.PROCESSING]: [WebsiteOrderStatus.RECEIPT_ISSUED],
    [WebsiteOrderStatus.RECEIPT_ISSUED]: [WebsiteOrderStatus.DISPATCHED],
    [WebsiteOrderStatus.DISPATCHED]: [WebsiteOrderStatus.PAYMENT_CONFIRMED],
    [WebsiteOrderStatus.PAYMENT_CONFIRMED]: [WebsiteOrderStatus.DELIVERED],
  };

  const allowedNext = allowedTransitions[current] ?? [];
  if (!allowedNext.includes(next)) {
    return {
      ok: false as const,
      error: `Website order must move from ${current.replace(/_/g, " ")} to the next step before ${next.replace(/_/g, " ")}.`,
    };
  }

  return { ok: true as const };
}

export function buildWebsiteOrderReceiptPayload(order: SerializedWebsiteOrder, mode: "pod" | "normal") {
  const prefill = buildWebsiteOrderReceiptPrefill(order, mode);
  return {
    serial: order.orderRef,
    docType: "RECEIPT",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail || undefined,
    customerType: prefill.customerType,
    deliveryAddress: prefill.deliveryAddress,
    paymentMethod: prefill.paymentMethod,
    notes: prefill.notes,
    metadata: prefill.metadata,
    podDelivery: prefill.podDelivery,
    websiteOrderId: order.id,
    items: prefill.items.map((item) => ({
      productId: item.productId ?? undefined,
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sku: item.sku ?? undefined,
    })),
  };
}

export async function requireWebsiteOrdersAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, session, userId, role };
}

export async function requireWebsiteOrdersStaffActor(options?: { impersonateId?: string | null }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const email = normalizeEmail((session?.user as { email?: string } | undefined)?.email);

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const hasElevatedRole = role === "ADMIN" || role === "SUPERVISOR";
  if (hasElevatedRole && options?.impersonateId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: options.impersonateId },
      select: { id: true, name: true, email: true },
    });
    if (!targetUser || !isWebsiteOrdersStaffEmail(targetUser.email)) {
      return { ok: false as const, status: 403, error: "Invalid website-order attendant target." };
    }
    return {
      ok: true as const,
      session,
      role,
      actorUserId: userId,
      userId: targetUser.id,
      email: normalizeEmail(targetUser.email),
      name: targetUser.name ?? targetUser.email ?? "Website order attendant",
      isElevatedActor: true,
    };
  }

  if (!hasElevatedRole && !isWebsiteOrdersStaffEmail(email)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    session,
    role,
    actorUserId: userId,
    userId,
    email,
    name:
      (session.user as { name?: string } | undefined)?.name ??
      (session.user as { email?: string } | undefined)?.email ??
      "Website order attendant",
    isElevatedActor: hasElevatedRole,
  };
}

export async function ensureWebsiteOrderAssignments() {
  await ensureWebsiteOrdersSchema();
  const staffUsers = await prisma.user.findMany({
    where: { email: { in: [...WEBSITE_ORDER_STAFF_EMAILS] } },
    select: { id: true, name: true, email: true },
  });

  const orderedStaff = WEBSITE_ORDER_STAFF_EMAILS.map((email) =>
    staffUsers.find((user) => normalizeEmail(user.email) === email),
  ).filter(
    (user): user is { id: string; name: string | null; email: string | null } => Boolean(user?.id),
  );

  if (!orderedStaff.length) return orderedStaff;

  const staffIds = new Set(orderedStaff.map((user) => user.id));
  const orders = await prisma.websiteOrder.findMany({
    select: {
      id: true,
      metadata: true,
      createdAt: true,
      confirmedById: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const assignmentCounts = new Map<string, number>(orderedStaff.map((user) => [user.id, 0]));
  const queuedAssignments: Array<{
    id: string;
    metadata: Record<string, unknown>;
    assignee: { id: string; name: string | null; email: string | null };
  }> = [];

  let roundRobinIndex = 0;

  for (const order of orders) {
    const currentAssignment = readWebsiteOrderAssignment(order.metadata);
    const assignedById =
      currentAssignment?.id && staffIds.has(currentAssignment.id)
        ? orderedStaff.find((user) => user.id === currentAssignment.id) ?? null
        : null;
    const assignedByEmail =
      currentAssignment?.email
        ? orderedStaff.find((user) => normalizeEmail(user.email) === currentAssignment.email) ?? null
        : null;
    const resolvedCurrentAssignee = assignedById ?? assignedByEmail;

    if (resolvedCurrentAssignee) {
      assignmentCounts.set(
        resolvedCurrentAssignee.id,
        Number(assignmentCounts.get(resolvedCurrentAssignee.id) ?? 0) + 1,
      );
      if (
        currentAssignment?.id !== resolvedCurrentAssignee.id ||
        currentAssignment?.email !== normalizeEmail(resolvedCurrentAssignee.email) ||
        currentAssignment?.name !== (resolvedCurrentAssignee.name ?? resolvedCurrentAssignee.email ?? "Website order attendant")
      ) {
        const metadata =
          order.metadata && typeof order.metadata === "object"
            ? { ...(order.metadata as Record<string, unknown>) }
            : {};
        queuedAssignments.push({
          id: order.id,
          metadata,
          assignee: resolvedCurrentAssignee,
        });
      }
      continue;
    }

    const metadata =
      order.metadata && typeof order.metadata === "object"
        ? { ...(order.metadata as Record<string, unknown>) }
        : {};
    const confirmedStaff = order.confirmedById && staffIds.has(order.confirmedById)
      ? orderedStaff.find((user) => user.id === order.confirmedById) ?? null
      : null;
    const assignee =
      confirmedStaff ??
      [...orderedStaff]
        .sort((left, right) => {
          const countDiff =
            Number(assignmentCounts.get(left.id) ?? 0) - Number(assignmentCounts.get(right.id) ?? 0);
          if (countDiff !== 0) return countDiff;
          const leftIndex = orderedStaff.findIndex((user) => user.id === left.id);
          const rightIndex = orderedStaff.findIndex((user) => user.id === right.id);
          const leftScore = (leftIndex - roundRobinIndex + orderedStaff.length) % orderedStaff.length;
          const rightScore = (rightIndex - roundRobinIndex + orderedStaff.length) % orderedStaff.length;
          return leftScore - rightScore;
        })[0];

    if (!assignee) continue;
    roundRobinIndex = (orderedStaff.findIndex((user) => user.id === assignee.id) + 1) % orderedStaff.length;
    assignmentCounts.set(assignee.id, Number(assignmentCounts.get(assignee.id) ?? 0) + 1);
    queuedAssignments.push({ id: order.id, metadata, assignee });
  }

  for (const assignment of queuedAssignments) {
    await prisma.websiteOrder.update({
      where: { id: assignment.id },
      data: {
        metadata: {
          ...assignment.metadata,
          assignedAttendantId: assignment.assignee.id,
          assignedAttendantEmail: normalizeEmail(assignment.assignee.email),
          assignedAttendantName:
            assignment.assignee.name ?? assignment.assignee.email ?? "Website order attendant",
          assignedAt:
            typeof assignment.metadata.assignedAt === "string" && assignment.metadata.assignedAt
              ? assignment.metadata.assignedAt
              : new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  return orderedStaff;
}

export function isWebsiteOrderAssignedToUser(
  metadata: unknown,
  userId: string,
  email?: string | null,
) {
  const assigned = readWebsiteOrderAssignment(metadata);
  if (!assigned) return false;
  if (assigned.id === userId) return true;
  if (email && assigned.email === normalizeEmail(email)) return true;
  return false;
}

export function withWebsiteOrderAssignmentMetadata(
  metadata: unknown,
  assignment: { id: string; email?: string | null; name?: string | null },
) {
  const base = metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
  return {
    ...base,
    assignedAttendantId: assignment.id,
    assignedAttendantEmail: normalizeEmail(assignment.email),
    assignedAttendantName: assignment.name ?? assignment.email ?? "Website order attendant",
    assignedAt:
      typeof base.assignedAt === "string" && base.assignedAt ? base.assignedAt : new Date().toISOString(),
  } as Prisma.InputJsonValue;
}

export async function ensureWebsiteOrdersSchema() {
  if (!globalWebsiteOrderSchema.__websiteOrderSchemaReady) {
    globalWebsiteOrderSchema.__websiteOrderSchemaReady = (async () => {
      for (const statement of WEBSITE_ORDER_SCHEMA_SQL) {
        await prisma.$executeRawUnsafe(statement);
      }
    })();
  }
  return globalWebsiteOrderSchema.__websiteOrderSchemaReady;
}

export const WEBSITE_ORDER_ACTIVE_STATUSES: WebsiteOrderStatus[] = [
  WebsiteOrderStatus.PENDING,
  WebsiteOrderStatus.CONFIRMED,
  WebsiteOrderStatus.PROCESSING,
  WebsiteOrderStatus.RECEIPT_ISSUED,
  WebsiteOrderStatus.DISPATCHED,
  WebsiteOrderStatus.PAYMENT_CONFIRMED,
  WebsiteOrderStatus.DELIVERED,
  WebsiteOrderStatus.CANCELLED,
];
