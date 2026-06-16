import { Prisma, WebsiteOrderStatus, WebsiteOrderType, type User } from "@prisma/client";
import { randomUUID } from "crypto";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureWebsiteOrdersSchema } from "@/lib/websiteOrders";

function normalizeCustomerEmail(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "";
}

function readJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function buildCustomerLocation(
  metadata: Record<string, unknown>,
  data: Record<string, unknown>,
  user: Pick<User, "county" | "town" | "estateLandmark" | "locationNotes"> | null,
) {
  const deliveryAddress = pickFirstNonEmpty(
    typeof metadata.deliveryAddress === "string" ? metadata.deliveryAddress : "",
    typeof data.deliveryAddress === "string" ? data.deliveryAddress : "",
  );

  if (deliveryAddress) return deliveryAddress;

  const townCounty = [user?.town, user?.county].map((value) => String(value || "").trim()).filter(Boolean).join(", ");
  if (townCounty) return townCounty;

  return pickFirstNonEmpty(user?.estateLandmark, user?.locationNotes, "Betech POS customer");
}

function inferWebsiteOrderType(data: Record<string, unknown>, customerLocation: string) {
  const customerType = String(data.customerType || "").trim().toLowerCase();
  if (customerType === "pod") return WebsiteOrderType.POD;
  if (customerType === "delivery") return WebsiteOrderType.PREPAID;
  if (customerType === "online") return WebsiteOrderType.PREPAID;
  if (customerLocation) return WebsiteOrderType.PREPAID;
  return WebsiteOrderType.SHOP_PICKUP;
}

async function resolveExistingCustomerUsers(args: { normalizedPhone: string; normalizedEmail: string }) {
  const [phoneUser, emailUser] = await Promise.all([
    args.normalizedPhone
      ? prisma.user.findUnique({
          where: { phone: args.normalizedPhone },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            county: true,
            town: true,
            estateLandmark: true,
            locationNotes: true,
          },
        })
      : Promise.resolve(null),
    args.normalizedEmail
      ? prisma.user.findUnique({
          where: { email: args.normalizedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            county: true,
            town: true,
            estateLandmark: true,
            locationNotes: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return { phoneUser, emailUser };
}

async function findOrCreateCustomerUser(input: {
  customerName: string;
  normalizedPhone: string;
  normalizedEmail: string;
}): Promise<{
  user: Pick<User, "id" | "name" | "email" | "phone" | "county" | "town" | "estateLandmark" | "locationNotes">;
  matchedBy: "phone" | "email" | "created";
  emailConflict: boolean;
}> {
  const { phoneUser, emailUser } = await resolveExistingCustomerUsers(input);
  const hasPhoneIdentity = Boolean(input.normalizedPhone);
  const conflictingAccounts =
    Boolean(phoneUser?.id) &&
    Boolean(emailUser?.id) &&
    phoneUser!.id !== emailUser!.id;

  const existing = hasPhoneIdentity
    ? phoneUser
    : phoneUser && emailUser && phoneUser.id === emailUser.id
      ? phoneUser
      : phoneUser || emailUser;

  if (existing) {
    const updateData: Prisma.UserUpdateInput = {};
    if (input.customerName && input.customerName !== existing.name) {
      updateData.name = input.customerName;
    }
    if (input.normalizedPhone && !existing.phone && (!phoneUser || phoneUser.id === existing.id)) {
      updateData.phone = input.normalizedPhone;
    }
    if (
      input.normalizedEmail &&
      !existing.email &&
      (!emailUser || emailUser.id === existing.id) &&
      !conflictingAccounts
    ) {
      updateData.email = input.normalizedEmail;
    }

    if (Object.keys(updateData).length) {
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          county: true,
          town: true,
          estateLandmark: true,
          locationNotes: true,
        },
      });
      return {
        user,
        matchedBy: hasPhoneIdentity ? "phone" : emailUser?.id === existing.id ? "email" : "phone",
        emailConflict: conflictingAccounts,
      };
    }

    return {
      user: existing,
      matchedBy: hasPhoneIdentity ? "phone" : emailUser?.id === existing.id ? "email" : "phone",
      emailConflict: conflictingAccounts,
    };
  }

  if (hasPhoneIdentity) {
    const user = await prisma.user.create({
      data: {
        name: input.customerName || null,
        phone: input.normalizedPhone || null,
        email: input.normalizedEmail && !emailUser ? input.normalizedEmail : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        county: true,
        town: true,
        estateLandmark: true,
        locationNotes: true,
      },
    });
    return {
      user,
      matchedBy: "created",
      emailConflict: Boolean(emailUser),
    };
  }

  const user = await prisma.user.create({
    data: {
      name: input.customerName || null,
      phone: input.normalizedPhone || null,
      email: input.normalizedEmail || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      county: true,
      town: true,
      estateLandmark: true,
      locationNotes: true,
    },
  });
  return {
    user,
    matchedBy: "created",
    emailConflict: false,
  };
}

export async function syncPosReceiptToCustomerAccount(receiptId: string) {
  await ensureWebsiteOrdersSchema();

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true,
      receiptNumber: true,
      generatedAt: true,
      createdAt: true,
      data: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          totalAmount: true,
          metadata: true,
          items: {
            select: {
              id: true,
              productId: true,
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

  const order = receipt.order;
  const data = readJsonObject(receipt.data);
  const metadata = readJsonObject(order.metadata);
  const normalizedPhone = normalizeKenyanPhone(order.customerPhone || String(data.customerPhone || ""));
  const normalizedEmail = normalizeCustomerEmail(order.customerEmail || String(data.customerEmail || ""));
  const customerName = pickFirstNonEmpty(order.customerName, String(data.customerName || ""));

  const customerResolution =
    normalizedPhone || normalizedEmail || customerName
      ? await findOrCreateCustomerUser({
          customerName,
          normalizedPhone,
          normalizedEmail,
        })
      : null;
  const customerUser = customerResolution?.user ?? null;

  const customerLocation = buildCustomerLocation(metadata, data, customerUser);
  const orderType = inferWebsiteOrderType(data, customerLocation);
  const deliveryMethod =
    orderType === WebsiteOrderType.POD
      ? "POS Pay on Delivery"
      : orderType === WebsiteOrderType.SHOP_PICKUP
        ? "POS Walk-in"
        : "POS Delivery";
  const paymentMethod = pickFirstNonEmpty(String(data.paymentMethod || ""), "CASH");
  const receiptRef = receipt.receiptNumber || order.orderNumber;
  const lifecyclePatch = {
    receiptIssuedAt: receipt.generatedAt.toISOString(),
    paymentConfirmedAt: receipt.createdAt.toISOString(),
    deliveredAt: receipt.createdAt.toISOString(),
    paymentConfirmationMethod: paymentMethod,
    receiptFlowMode: orderType === WebsiteOrderType.POD ? "pod" : "normal",
    posReceiptId: receipt.id,
    posOrderId: order.id,
    posReceiptNumber: receiptRef,
  } satisfies Record<string, string>;

  const existing = await prisma.websiteOrder.findFirst({
    where: {
      OR: [{ receiptId: receipt.id }, { orderRef: order.orderNumber }],
    },
    select: {
      id: true,
      source: true,
      status: true,
      deliveryMethod: true,
      paymentMethod: true,
      orderType: true,
      notes: true,
      metadata: true,
    },
  });

  const existingMetadata = readJsonObject(existing?.metadata);
  const nextSource = existing?.source === "WEBSITE" ? "WEBSITE" : "POS";
  const nextStatus =
    existing?.source === "WEBSITE" ? existing.status : WebsiteOrderStatus.DELIVERED;

  const baseData = {
    orderRef: order.orderNumber,
    customerUserId: customerUser?.id ?? null,
    customerName: customerName || "Betech customer",
    customerPhone: normalizedPhone || order.customerPhone || "",
    customerEmail: normalizedEmail || order.customerEmail || null,
    customerLocation,
    deliveryMethod: existing?.source === "WEBSITE" ? existing.deliveryMethod : deliveryMethod,
    paymentMethod: existing?.source === "WEBSITE" ? existing.paymentMethod : paymentMethod,
    orderType: existing?.source === "WEBSITE" ? existing.orderType : orderType,
    status: nextStatus,
    subtotal: new Prisma.Decimal(Number(order.totalAmount || 0)),
    total: new Prisma.Decimal(Number(order.totalAmount || 0)),
    notes:
      existing?.source === "WEBSITE"
        ? existing.notes
        : typeof data.notes === "string" && data.notes.trim()
          ? data.notes.trim()
          : null,
    source: nextSource,
    receiptId: receipt.id,
    confirmedAt: existing?.source === "WEBSITE" ? undefined : receipt.createdAt,
    metadata: {
      ...existingMetadata,
      ...lifecyclePatch,
      posCustomerIdentitySource: customerResolution?.matchedBy ?? null,
      posCustomerEmailConflict: customerResolution?.emailConflict ?? false,
      posReceiptDeliveryEmail: normalizedEmail || order.customerEmail || null,
    },
  } satisfies Prisma.WebsiteOrderUncheckedCreateInput;

  const itemRows = order.items.map((item) => ({
    id: randomUUID(),
    websiteOrderId: existing?.id || "",
    productId: item.productId || null,
    productName: item.product?.name || "POS item",
    quantity: item.quantity,
    unitPrice: new Prisma.Decimal(Number(item.sellingPrice || 0)),
    total: new Prisma.Decimal(Number(item.sellingPrice || 0) * Number(item.quantity || 0)),
    sku: item.product?.sku || null,
    category: item.product?.category || null,
  }));

  const websiteOrder = await prisma.$transaction(async (tx) => {
    const saved =
      existing
        ? await tx.websiteOrder.update({
            where: { id: existing.id },
            data: baseData,
          })
        : await tx.websiteOrder.create({
            data: {
              id: randomUUID(),
              ...baseData,
            },
          });

    await tx.websiteOrderItem.deleteMany({ where: { websiteOrderId: saved.id } });

    if (itemRows.length) {
      await tx.websiteOrderItem.createMany({
        data: itemRows.map((item) => ({
          ...item,
          websiteOrderId: saved.id,
        })),
      });
    }

    return saved;
  });

  return {
    websiteOrderId: websiteOrder.id,
    customerUserId: customerUser?.id ?? null,
    source: websiteOrder.source,
    status: websiteOrder.status,
    matchedBy: customerResolution?.matchedBy ?? null,
    emailConflict: customerResolution?.emailConflict ?? false,
  };
}

export async function backfillPosReceiptsForCustomerAccount(args: {
  phoneVariants?: string[];
  normalizedEmail?: string;
  limit?: number;
}) {
  const phoneVariants = Array.from(
    new Set((args.phoneVariants || []).map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const normalizedEmail = normalizeCustomerEmail(args.normalizedEmail);
  const limit = Math.max(1, Math.min(50, Number(args.limit || 12)));

  if (!phoneVariants.length && !normalizedEmail) {
    return { receiptIds: [] as string[], synced: 0 };
  }

  const receipts = await prisma.receipt.findMany({
    where: {
      order: {
        OR: [
          ...(phoneVariants.length ? [{ customerPhone: { in: phoneVariants } }] : []),
          ...(normalizedEmail ? [{ customerEmail: normalizedEmail }] : []),
        ],
      },
    },
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true },
  });

  let synced = 0;
  for (const receipt of receipts) {
    try {
      const result = await syncPosReceiptToCustomerAccount(receipt.id);
      if (result?.websiteOrderId) synced += 1;
    } catch (error) {
      console.error("[pos account backfill] failed to sync receipt", {
        receiptId: receipt.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    receiptIds: receipts.map((receipt) => receipt.id),
    synced,
  };
}
