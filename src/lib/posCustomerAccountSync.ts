import { Prisma, WebsiteOrderStatus, WebsiteOrderType } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  findOrCreateCustomerIdentityUser,
  normalizeCustomerIdentityEmail,
  type SafeCustomerIdentityUser,
} from "@/lib/customerIdentity";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureReviewInvitationsForWebsiteOrder, syncReferralLinkForWebsiteOrder } from "@/lib/reviewsReferrals";
import { ensureWebsiteOrdersSchema } from "@/lib/websiteOrders";

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
  user: Pick<SafeCustomerIdentityUser, "county" | "town" | "estateLandmark" | "locationNotes"> | null,
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

function readPodDeliveryState(data: Record<string, unknown>) {
  const podDelivery =
    data.podDelivery && typeof data.podDelivery === "object" && !Array.isArray(data.podDelivery)
      ? (data.podDelivery as Record<string, unknown>)
      : null;
  const status = typeof podDelivery?.status === "string" ? podDelivery.status.trim().toLowerCase() : "";
  return { podDelivery, status };
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
  const normalizedEmail = normalizeCustomerIdentityEmail(order.customerEmail || String(data.customerEmail || ""));
  const customerName = pickFirstNonEmpty(order.customerName, String(data.customerName || ""));

  const customerResolution =
    normalizedPhone || normalizedEmail || customerName
      ? await findOrCreateCustomerIdentityUser({
          customerName,
          customerPhone: normalizedPhone,
          customerEmail: normalizedEmail,
        })
      : null;
  const customerUser = customerResolution?.user ?? null;

  const customerLocation = buildCustomerLocation(metadata, data, customerUser);
  const orderType = inferWebsiteOrderType(data, customerLocation);
  const { status: podDeliveryStatus } = readPodDeliveryState(data);
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
    existing?.source === "WEBSITE"
      ? existing.status
      : orderType === WebsiteOrderType.POD
        ? podDeliveryStatus === "delivered"
          ? WebsiteOrderStatus.DELIVERED
          : WebsiteOrderStatus.PROCESSING
        : WebsiteOrderStatus.DELIVERED;

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

  await syncReferralLinkForWebsiteOrder(websiteOrder.id).catch((error) => {
    console.error("[referrals] failed to sync customer referral after POS receipt sync", {
      websiteOrderId: websiteOrder.id,
      receiptId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  await ensureReviewInvitationsForWebsiteOrder(websiteOrder.id).catch((error) => {
    console.error("[reviews] failed to provision review invitations after POS receipt sync", {
      websiteOrderId: websiteOrder.id,
      receiptId,
      error: error instanceof Error ? error.message : String(error),
    });
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
  normalizedEmails?: string[];
  limit?: number;
}) {
  const phoneVariants = Array.from(
    new Set((args.phoneVariants || []).map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const normalizedEmails = Array.from(
    new Set(
      [args.normalizedEmail, ...(args.normalizedEmails || [])]
        .map((value) => normalizeCustomerIdentityEmail(value))
        .filter(Boolean),
    ),
  );
  const limit = Math.max(1, Math.min(50, Number(args.limit || 12)));

  if (!phoneVariants.length && !normalizedEmails.length) {
    return { receiptIds: [] as string[], synced: 0 };
  }

  const receipts = await prisma.receipt.findMany({
    where: {
      order: {
        OR: [
          ...(phoneVariants.length ? [{ customerPhone: { in: phoneVariants } }] : []),
          ...(normalizedEmails.length ? [{ customerEmail: { in: normalizedEmails } }] : []),
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
