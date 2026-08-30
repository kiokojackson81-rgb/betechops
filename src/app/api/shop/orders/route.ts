import { NextRequest, NextResponse } from "next/server";
import { applyReferralAttributionToUser, ensureAttributionSchema, REFERRAL_COOKIE_NAME } from "@/lib/attribution";
import { CUSTOMER_REFERRAL_COOKIE_NAME } from "@/lib/referralCookies";
import { prisma } from "@/lib/prisma";
import { findOrCreateCustomerIdentityUser } from "@/lib/customerIdentity";
import { ensureReviewInvitationsForWebsiteOrder, syncReferralLinkForWebsiteOrder } from "@/lib/reviewsReferrals";
import {
  buildWebsiteOrderRef,
  deriveWebsiteOrderType,
  ensureWebsiteOrdersSchema,
  serializeWebsiteOrder,
  type WebsiteOrderListRow,
  websiteOrderAdminInclude,
  websiteOrderCreateSchema,
} from "@/lib/websiteOrders";
import { getShopProducts } from "@/app/shop/shopApi";
import { getShopOrderSuccessHref } from "@/app/shop/storefrontPaths";

export const dynamic = "force-dynamic";

function buildEntityId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `btweb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function buildUniqueOrderRef() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderRef = buildWebsiteOrderRef();
    const existing = await prisma.websiteOrder.findUnique({ where: { orderRef }, select: { id: true } });
    if (!existing) return orderRef;
  }
  throw new Error("Unable to generate website order reference");
}

async function loadWebsiteOrderRow(id: string): Promise<WebsiteOrderListRow | null> {
  return prisma.websiteOrder.findUnique({
    where: { id },
    include: websiteOrderAdminInclude,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = websiteOrderCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid order payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (data.projectBooking || data.items.some((item) => item.bookingType === "INSTALLATION")) {
    return NextResponse.json(
      { ok: false, error: "Installation bookings must be submitted to the Projects workspace." },
      { status: 400 },
    );
  }
  await ensureWebsiteOrdersSchema();
  await ensureAttributionSchema();
  const products = await getShopProducts();
  const productMap = new Map(products.map((product) => [product.id, product]));
  const missingProduct = data.items.find((item) => !productMap.has(item.productId));

  if (missingProduct) {
    return NextResponse.json({ ok: false, error: "One or more products were not found." }, { status: 400 });
  }

  const orderRef = await buildUniqueOrderRef();
  const orderType = deriveWebsiteOrderType(data.deliveryMethod, data.paymentMethod);
  const items = data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const quantity = Math.max(1, item.quantity);
    const unitPrice = Number(product.price || 0);
    return {
      cartProductId: item.productId,
      productId: product.opsProductId ?? (product.source === "mock" ? null : product.id),
      productName: product.name,
      quantity,
      unitPrice,
      total: unitPrice * quantity,
      sku: null,
      category: product.category ?? null,
      bookingType: item.bookingType,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const customerIdentity = await findOrCreateCustomerIdentityUser({
    customerName: data.customerName.trim(),
    customerPhone: data.customerPhone.trim(),
    customerEmail: data.customerEmail?.trim() || null,
    locationNotes: data.notes?.trim() || null,
  });
  const referralCode = request.cookies.get(REFERRAL_COOKIE_NAME)?.value || "";
  const customerReferralCode = request.cookies.get(CUSTOMER_REFERRAL_COOKIE_NAME)?.value || "";
  const resolvedReferral = await applyReferralAttributionToUser(customerIdentity.user.id, referralCode);

  const created = await prisma.websiteOrder.create({
    data: {
      id: buildEntityId(),
      orderRef,
      customerUserId: customerIdentity.user.id,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      customerLocation: data.customerLocation.trim(),
      customerEmail: data.customerEmail?.trim() || null,
      deliveryMethod: data.deliveryMethod.trim(),
      paymentMethod: data.paymentMethod.trim(),
      orderType,
      status: "PENDING",
      subtotal,
      deliveryFee: null,
      total: subtotal,
      notes: data.notes?.trim() || null,
      source: "WEBSITE",
      referredByAgentId: resolvedReferral?.agentUserId ?? null,
      attributionCodeUsed: resolvedReferral?.referralCode ?? null,
      metadata: {
        checkoutSource: "shop",
        customerIdentitySource: customerIdentity.matchedBy,
        customerEmailConflict: customerIdentity.emailConflict,
        referredByAgentId: resolvedReferral?.agentUserId ?? null,
        referredByAgentName: resolvedReferral?.agentName ?? null,
        referredByAgentEmail: resolvedReferral?.agentEmail ?? null,
        attributionCodeUsed: resolvedReferral?.referralCode ?? null,
        customerReferralCode: customerReferralCode || null,
        orderIntent: "PRODUCT_ORDER",
      },
      items: {
        create: items.map((item) => ({
          id: buildEntityId(),
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          sku: item.sku,
          category: item.category,
        })),
      },
    },
  });

  const createdRow = await loadWebsiteOrderRow(created.id);
  if (!createdRow) {
    return NextResponse.json({ ok: false, error: "Website order was created but could not be loaded." }, { status: 500 });
  }

  await syncReferralLinkForWebsiteOrder(created.id).catch((error) => {
    console.error("[referrals] failed to sync customer referral for website order", {
      orderId: created.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  await ensureReviewInvitationsForWebsiteOrder(created.id).catch((error) => {
    console.error("[reviews] failed to provision review invitations for website order", {
      orderId: created.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return NextResponse.json({
    ok: true,
    source: "website",
    orderRef: createdRow.orderRef,
    status: createdRow.status,
    successUrl: getShopOrderSuccessHref(createdRow.orderRef),
    order: await serializeWebsiteOrder(createdRow),
  });
}

export async function GET(request: Request) {
  await ensureWebsiteOrdersSchema();
  const url = request?.url ? new URL(request.url) : null;
  const orderRef = String(url?.searchParams.get("ref") || "").trim();

  if (orderRef) {
    const order = await prisma.websiteOrder.findUnique({
      where: { orderRef },
      include: websiteOrderAdminInclude,
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
    }

    const serialized = await serializeWebsiteOrder(order);
    return NextResponse.json({
      ok: true,
      order: {
        id: serialized.id,
        orderRef: serialized.orderRef,
        customerName: serialized.customerName,
        customerPhone: serialized.customerPhone,
        customerLocation: serialized.customerLocation,
        customerEmail: serialized.customerEmail,
        deliveryMethod: serialized.deliveryMethod,
        paymentMethod: serialized.paymentMethod,
        orderType: serialized.orderType,
        status: serialized.status,
        subtotal: serialized.subtotal,
        total: serialized.total,
        receiptId: serialized.receiptId,
        receipt: serialized.receipt,
        createdAt: serialized.createdAt,
        updatedAt: serialized.updatedAt,
        processingAt: serialized.processingAt,
        receiptIssuedAt: serialized.receiptIssuedAt,
        dispatchedAt: serialized.dispatchedAt,
        paymentConfirmedAt: serialized.paymentConfirmedAt,
        paymentConfirmationMethod: serialized.paymentConfirmationMethod,
        paymentConfirmationReference: serialized.paymentConfirmationReference,
        deliveredAt: serialized.deliveredAt,
        items: serialized.items,
        referredByAgentId: serialized.referredByAgentId,
        attributionCodeUsed: serialized.attributionCodeUsed,
        referredByAgent: serialized.referredByAgent,
      },
    });
  }

  return NextResponse.json({ ok: true, message: "Use POST /api/shop/orders to place website orders." });
}
