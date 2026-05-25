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
        'RECEIPT_ISSUED',
        'PROCESSING',
        'DELIVERED',
        'CANCELLED'
      );
    END IF;
  END $$`,
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
  `CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteOrder_orderRef_key" ON "WebsiteOrder"("orderRef")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteOrder_receiptId_key" ON "WebsiteOrder"("receiptId")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrder_status_createdAt_idx" ON "WebsiteOrder"("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "WebsiteOrder_orderType_createdAt_idx" ON "WebsiteOrder"("orderType", "createdAt")`,
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
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerEmail: string | null;
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
  cancelledAt: string | null;
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

export function serializeWebsiteOrder(order: WebsiteOrderListRow) {
  const subtotal = toNumberValue(order.subtotal) ?? 0;
  const deliveryFee = toNumberValue(order.deliveryFee);
  const total = toNumberValue(order.total) ?? 0;

  return {
    id: order.id,
    orderRef: order.orderRef,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerLocation: order.customerLocation,
    customerEmail: order.customerEmail,
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
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    metadata: order.metadata ?? null,
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

export function buildWebsiteOrderReceiptPrefill(order: ReturnType<typeof serializeWebsiteOrder>, mode: "pod" | "normal") {
  const isPickup = order.orderType === WebsiteOrderType.SHOP_PICKUP || order.deliveryMethod.toLowerCase().includes("pickup");
  const customerType = mode === "pod" ? "pod" : isPickup ? "online" : "delivery";
  const paymentMethod = mode === "pod" ? "CASH" : "MPESA";
  const notes = [
    `Website order ref: ${order.orderRef}`,
    `Website payment option: ${order.paymentMethod}`,
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
  WebsiteOrderStatus.RECEIPT_ISSUED,
  WebsiteOrderStatus.PROCESSING,
  WebsiteOrderStatus.DELIVERED,
  WebsiteOrderStatus.CANCELLED,
];
