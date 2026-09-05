import { Prisma } from "@prisma/client";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureWebsiteOrdersSchema } from "@/lib/websiteOrders";

type CustomerProfileLike = {
  phone?: string | null;
  email?: string | null;
};

type SessionUserLike = {
  id: string;
  phone?: string | null;
  email?: string | null;
};

type ReceiptMetadataRecord = Record<string, unknown>;

export type CustomerAccountIdentity = {
  userId: string;
  normalizedPhones: string[];
  phoneVariants: string[];
  normalizedEmails: string[];
};

export type CustomerAccountOrderSummary = {
  routeId: string;
  orderRef: string;
  status: string;
  total: number;
  createdAt: string;
  deliveryMethod: string;
  customerLocation: string;
  itemsCount: number;
  receiptId: string | null;
  source: "WEBSITE" | "POS";
  itemPreview: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku: string | null;
    category: string | null;
  }>;
};

export type CustomerAccountOrderDetail = {
  routeId: string;
  orderRef: string;
  status: string;
  total: number;
  subtotal: number;
  createdAt: string;
  deliveryMethod: string;
  customerLocation: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  paymentMethod: string;
  notes: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  itemsCount: number;
  source: "WEBSITE" | "POS";
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku: string | null;
    category: string | null;
  }>;
};

function readJsonObject(value: unknown): ReceiptMetadataRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ReceiptMetadataRecord;
  }
  return {};
}

function normalizeCustomerEmail(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "";
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  const numeric = typeof value === "object" && "toNumber" in value ? value.toNumber() : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildReceiptLocation(metadata: ReceiptMetadataRecord) {
  const deliveryAddress = typeof metadata.deliveryAddress === "string" ? metadata.deliveryAddress.trim() : "";
  return deliveryAddress || "Final receipt linked to your account.";
}

function buildReceiptDeliveryMethod(metadata: ReceiptMetadataRecord) {
  const deliveryAddress = typeof metadata.deliveryAddress === "string" ? metadata.deliveryAddress.trim() : "";
  if (deliveryAddress) return "Complete order";
  return "Complete order";
}

function buildCustomerProjectStatus(metadata: ReceiptMetadataRecord, fallback: string) {
  switch (String(metadata.projectStage || "").trim().toUpperCase()) {
    case "RECEIPT_CREATED":
      return "PENDING";
    case "PROJECT_SCHEDULED":
      return "CONFIRMED / SCHEDULED";
    case "PROJECT_IN_PROGRESS":
      return "IN PROGRESS";
    case "PROJECT_INSTALLED":
      return "INSTALLED";
    case "COMPLETED_POSTED":
      return "COMPLETE";
    default:
      return fallback;
  }
}

function matchesPhoneIdentity(phoneValue: string | null | undefined, phoneVariants: string[]) {
  const normalizedPhone = normalizeKenyanPhone(phoneValue || "");
  if (!normalizedPhone) return false;
  return phoneVariants.includes(normalizedPhone) || getKenyanPhoneVariants(normalizedPhone).some((variant) => phoneVariants.includes(variant));
}

function matchesEmailIdentity(emailValue: string | null | undefined, normalizedEmails: string[]) {
  const normalizedEmail = normalizeCustomerEmail(emailValue);
  if (!normalizedEmail) return false;
  return normalizedEmails.includes(normalizedEmail);
}

export function canCustomerAccessAccountOrder(args: {
  customerUserId?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
}) {
  // An explicit account association always wins. Never let a shared or
  // recycled phone/email grant access to a record belonging to another user.
  if (args.customerUserId) {
    return args.customerUserId === args.userId;
  }

  const hasPhoneIdentity = matchesPhoneIdentity(args.customerPhone, args.phoneVariants);
  if (String(args.customerPhone || "").trim()) {
    return hasPhoneIdentity;
  }

  return matchesEmailIdentity(args.customerEmail, args.normalizedEmails);
}

function isInternalTestRecord(input: {
  orderRef: string;
  itemPreview: Array<{ productName: string }>;
  metadata: unknown;
}) {
  const metadata = readJsonObject(input.metadata);
  if (
    metadata.isTest === true ||
    metadata.isInternal === true ||
    metadata.customerVisible === false ||
    metadata.hideFromCustomer === true
  ) {
    return true;
  }

  const labels = [input.orderRef, ...input.itemPreview.map((item) => item.productName)]
    .map((value) => String(value || "").trim().toLowerCase());
  return labels.some(
    (value) =>
      value === "test" ||
      value.startsWith("test-") ||
      value.startsWith("test ") ||
      value.includes("project verification package"),
  );
}

function buildSummaryFromWebsiteOrder(order: {
  id: string;
  orderRef: string;
  status: string;
  total: Prisma.Decimal | number;
  createdAt: Date;
  deliveryMethod: string;
  customerLocation: string;
  receiptId: string | null;
  source: string;
  metadata: unknown;
  _count: { items: number };
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: Prisma.Decimal | number;
    total: Prisma.Decimal | number;
    sku: string | null;
    category: string | null;
  }>;
}): CustomerAccountOrderSummary {
  const metadata = readJsonObject(order.metadata);
  return {
    routeId: `website-${order.id}`,
    orderRef: order.orderRef,
    status: buildCustomerProjectStatus(metadata, order.status),
    total: toNumber(order.total),
    createdAt: order.createdAt.toISOString(),
    deliveryMethod: order.deliveryMethod,
    customerLocation: order.customerLocation,
    itemsCount: order._count.items,
    receiptId: order.receiptId,
    source: order.source === "POS" ? "POS" : "WEBSITE",
    itemPreview: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      total: toNumber(item.total),
      sku: item.sku,
      category: item.category,
    })),
  };
}

function buildSummaryFromReceipt(receipt: {
  id: string;
  receiptNumber: string | null;
  generatedAt: Date;
  createdAt: Date;
  order: {
    orderNumber: string;
    totalAmount: Prisma.Decimal | number;
    metadata: unknown;
    items: Array<{
      id: string;
      quantity: number;
      sellingPrice: Prisma.Decimal | number;
      product: {
        name: string | null;
        sku: string | null;
        category: string | null;
      } | null;
    }>;
  } | null;
}): CustomerAccountOrderSummary {
  const metadata = readJsonObject(receipt.order?.metadata);
  return {
    routeId: `receipt-${receipt.id}`,
    orderRef: receipt.order?.orderNumber || receipt.receiptNumber || receipt.id,
    status: "COMPLETE",
    total: toNumber(receipt.order?.totalAmount),
    createdAt: (receipt.generatedAt || receipt.createdAt).toISOString(),
    deliveryMethod: buildReceiptDeliveryMethod(metadata),
    customerLocation: buildReceiptLocation(metadata),
    itemsCount: receipt.order?.items.length || 0,
    receiptId: receipt.id,
    source: "POS",
    itemPreview:
      receipt.order?.items.map((item) => ({
        productName: item.product?.name || "POS item",
        quantity: item.quantity,
        unitPrice: toNumber(item.sellingPrice),
        total: toNumber(item.sellingPrice) * item.quantity,
        sku: item.product?.sku || null,
        category: item.product?.category || null,
      })) || [],
  };
}

export function buildCustomerAccountIdentity(
  user: SessionUserLike,
  customerProfile?: CustomerProfileLike | null,
): CustomerAccountIdentity {
  const normalizedPhones = Array.from(
    new Set([customerProfile?.phone, user.phone].map((value) => normalizeKenyanPhone(value || "")).filter(Boolean)),
  );
  const phoneVariants = Array.from(new Set(normalizedPhones.flatMap((value) => getKenyanPhoneVariants(value))));
  const normalizedEmails = Array.from(
    new Set([customerProfile?.email, user.email].map((value) => normalizeCustomerEmail(value)).filter(Boolean)),
  );

  return {
    userId: user.id,
    normalizedPhones,
    phoneVariants,
    normalizedEmails,
  };
}

export async function listCustomerAccountOrders(args: {
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
  take?: number;
}) {
  await ensureWebsiteOrdersSchema();

  const legacyWebsiteIdentityWhere: Prisma.WebsiteOrderWhereInput[] = [
    ...(args.phoneVariants.length ? [{ customerPhone: { in: args.phoneVariants } }] : []),
    ...(args.normalizedEmails.length ? [{ customerEmail: { in: args.normalizedEmails } }] : []),
  ];

  const recentOrders = await prisma.websiteOrder.findMany({
    where: {
      OR: [
        { customerUserId: args.userId },
        // Legacy orders have no account id. Their recorded phone/email must
        // match this signed-in customer's verified account identity.
        ...(legacyWebsiteIdentityWhere.length
          ? [{ customerUserId: null, OR: legacyWebsiteIdentityWhere }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: args.take ?? 20,
    select: {
      id: true,
      orderRef: true,
      receiptId: true,
      status: true,
      total: true,
      createdAt: true,
      deliveryMethod: true,
      customerLocation: true,
      source: true,
      metadata: true,
      customerUserId: true,
      customerPhone: true,
      customerEmail: true,
      _count: {
        select: {
          items: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
        take: 3,
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          total: true,
          sku: true,
          category: true,
        },
      },
    },
  });

  const fallbackReceipts = await prisma.receipt.findMany({
    where: {
      order: {
        OR: [
          ...(args.phoneVariants.length ? [{ customerPhone: { in: args.phoneVariants } }] : []),
          ...(args.normalizedEmails.length ? [{ customerEmail: { in: args.normalizedEmails } }] : []),
        ],
      },
    },
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(args.take ?? 20, 20),
    select: {
      id: true,
      receiptNumber: true,
      generatedAt: true,
      createdAt: true,
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          metadata: true,
          customerPhone: true,
          customerEmail: true,
          items: {
            orderBy: { id: "asc" },
            take: 3,
            select: {
              id: true,
              quantity: true,
              sellingPrice: true,
              product: {
                select: {
                  name: true,
                  sku: true,
                  category: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const websiteSummaries = recentOrders
    .filter((order) =>
      canCustomerAccessAccountOrder({
        customerUserId: order.customerUserId,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        userId: args.userId,
        phoneVariants: args.phoneVariants,
        normalizedEmails: args.normalizedEmails,
      }),
    )
    .filter((order) =>
      !isInternalTestRecord({
        orderRef: order.orderRef,
        itemPreview: order.items,
        metadata: order.metadata,
      }),
    )
    .map(buildSummaryFromWebsiteOrder);
  const fallbackSummaries = fallbackReceipts
    .filter((receipt) => {
      const orderPhone = receipt.order?.customerPhone || "";
      if (String(orderPhone || "").trim()) {
        return matchesPhoneIdentity(orderPhone, args.phoneVariants);
      }
      return matchesEmailIdentity(receipt.order?.customerEmail || "", args.normalizedEmails);
    })
    .filter((receipt) => {
      const orderRef = receipt.order?.orderNumber || receipt.receiptNumber || receipt.id;
      return !recentOrders.some((order) => order.receiptId === receipt.id || order.orderRef === orderRef);
    })
    .filter((receipt) =>
      !isInternalTestRecord({
        orderRef: receipt.order?.orderNumber || receipt.receiptNumber || receipt.id,
        itemPreview: receipt.order?.items.map((item) => ({ productName: item.product?.name || "" })) || [],
        metadata: receipt.order?.metadata,
      }),
    )
    .map(buildSummaryFromReceipt);

  return [...websiteSummaries, ...fallbackSummaries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, args.take ?? 20);
}

export async function getCustomerAccountOrderDetail(args: {
  routeId: string;
  userId: string;
  phoneVariants: string[];
  normalizedEmails: string[];
}): Promise<CustomerAccountOrderDetail | null> {
  await ensureWebsiteOrdersSchema();

  if (args.routeId.startsWith("receipt-")) {
    const receiptId = args.routeId.slice("receipt-".length);
    if (!receiptId) return null;

    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        order: {
          OR: [
            ...(args.phoneVariants.length ? [{ customerPhone: { in: args.phoneVariants } }] : []),
            ...(args.normalizedEmails.length ? [{ customerEmail: { in: args.normalizedEmails } }] : []),
          ],
        },
      },
      select: {
        id: true,
        receiptNumber: true,
        generatedAt: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            totalAmount: true,
            metadata: true,
            items: {
              select: {
                id: true,
                quantity: true,
                sellingPrice: true,
                product: {
                  select: {
                    name: true,
                    sku: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!receipt?.order) return null;

    const hasPhoneOnReceipt = String(receipt.order.customerPhone || "").trim().length > 0;
    if (hasPhoneOnReceipt) {
      if (!matchesPhoneIdentity(receipt.order.customerPhone, args.phoneVariants)) {
        return null;
      }
    } else if (!matchesEmailIdentity(receipt.order.customerEmail, args.normalizedEmails)) {
      return null;
    }

    const metadata = readJsonObject(receipt.order.metadata);
    const items = receipt.order.items.map((item) => ({
      id: item.id,
      productName: item.product?.name || "POS item",
      quantity: item.quantity,
      unitPrice: toNumber(item.sellingPrice),
      total: toNumber(item.sellingPrice) * item.quantity,
      sku: item.product?.sku || null,
      category: item.product?.category || null,
    }));

    return {
      routeId: args.routeId,
      orderRef: receipt.order.orderNumber || receipt.receiptNumber || receipt.id,
      status: "COMPLETE",
      total: toNumber(receipt.order.totalAmount),
      subtotal: toNumber(receipt.order.totalAmount),
      createdAt: (receipt.generatedAt || receipt.createdAt).toISOString(),
      deliveryMethod: buildReceiptDeliveryMethod(metadata),
      customerLocation: buildReceiptLocation(metadata),
      customerName: receipt.order.customerName || "Betech customer",
      customerPhone: receipt.order.customerPhone || "",
      customerEmail: receipt.order.customerEmail || null,
      paymentMethod:
        typeof metadata.paymentMethod === "string" && metadata.paymentMethod.trim()
          ? metadata.paymentMethod.trim()
          : "CASH",
      notes: typeof metadata.notes === "string" && metadata.notes.trim() ? metadata.notes.trim() : null,
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
      source: "POS",
      items,
    };
  }

  if (!args.routeId.startsWith("website-")) return null;

  const websiteOrderId = args.routeId.slice("website-".length);
  if (!websiteOrderId) return null;

  const websiteOrder = await prisma.websiteOrder.findFirst({
    where: {
      id: websiteOrderId,
    },
    select: {
      id: true,
      orderRef: true,
      status: true,
      subtotal: true,
      total: true,
      createdAt: true,
      deliveryMethod: true,
      customerLocation: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      paymentMethod: true,
      notes: true,
      source: true,
      metadata: true,
      customerUserId: true,
      receiptId: true,
      receipt: {
        select: {
          id: true,
          receiptNumber: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          total: true,
          sku: true,
          category: true,
        },
      },
    },
  });

  if (!websiteOrder) return null;

  const canAccessWebsiteOrder = canCustomerAccessAccountOrder({
    customerUserId: websiteOrder.customerUserId,
    customerPhone: websiteOrder.customerPhone,
    customerEmail: websiteOrder.customerEmail,
    userId: args.userId,
    phoneVariants: args.phoneVariants,
    normalizedEmails: args.normalizedEmails,
  });

  if (!canAccessWebsiteOrder) return null;

  return {
    routeId: args.routeId,
    orderRef: websiteOrder.orderRef,
    status: buildCustomerProjectStatus(readJsonObject(websiteOrder.metadata), websiteOrder.status),
    total: toNumber(websiteOrder.total),
    subtotal: toNumber(websiteOrder.subtotal),
    createdAt: websiteOrder.createdAt.toISOString(),
    deliveryMethod: websiteOrder.deliveryMethod,
    customerLocation: websiteOrder.customerLocation,
    customerName: websiteOrder.customerName,
    customerPhone: websiteOrder.customerPhone,
    customerEmail: websiteOrder.customerEmail,
    paymentMethod: websiteOrder.paymentMethod,
    notes: websiteOrder.notes,
    receiptId: websiteOrder.receiptId,
    receiptNumber: websiteOrder.receipt?.receiptNumber || null,
    itemsCount: websiteOrder.items.reduce((sum, item) => sum + item.quantity, 0),
    source: websiteOrder.source === "POS" ? "POS" : "WEBSITE",
    items: websiteOrder.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      total: toNumber(item.total),
      sku: item.sku,
      category: item.category,
    })),
  };
}
