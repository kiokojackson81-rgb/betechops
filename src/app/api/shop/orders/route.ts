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
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import {
  calculateTransportFee,
  getDefaultTransportFee,
  inferLegacyProductCataloguePolicy,
  productCatalogueConfigurationSchema,
} from "@/lib/productCataloguePolicy";
import { resolveCheckoutTown, UNLISTED_TOWN_OPTION } from "@/lib/agents/kenyaMarkets";
import { getOpsBaseUrl, isOpsHost, isShopHost } from "@/lib/runtimeUrls";

export const dynamic = "force-dynamic";

function shouldUseOpsOrderStore(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  // Keep local development self-contained. In production, orders submitted on
  // the public shop must be created in the Ops deployment because that is the
  // database the Website Orders queue reads from.
  return isShopHost(host) && !isOpsHost(host);
}

function getOpsOrderUrl(request: Request) {
  const source = new URL(request.url);
  const ops = new URL(getOpsBaseUrl());
  return new URL(`${source.pathname}${source.search}`, ops);
}

function forwardedOrderHeaders(request: Request) {
  const headers = new Headers({
    Accept: "application/json",
  });
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

async function proxyOrderRequestToOps(request: Request, init?: RequestInit) {
  try {
    const response = await fetch(getOpsOrderUrl(request), {
      ...init,
      cache: "no-store",
      headers: forwardedOrderHeaders(request),
    });
    const contentType = response.headers.get("content-type") || "application/json";
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[website-orders] failed to reach the Ops order store", error);
    return NextResponse.json(
      { ok: false, error: "We could not save your order right now. Please try again." },
      { status: 502 },
    );
  }
}

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
  if (shouldUseOpsOrderStore(request)) {
    return proxyOrderRequestToOps(request, {
      method: "POST",
      body: await request.text(),
    });
  }

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

  let resolvedDeliveryZone = data.deliveryZone;
  let deliveryLocation: {
    county: string;
    town: string;
    townSource: "predefined" | "manual";
    nearestMajorTown: string | null;
  } | null = null;
  if (data.deliveryCounty || data.deliveryTown || data.townSource) {
    if (!data.deliveryCounty || !data.deliveryTown) {
      return NextResponse.json({ ok: false, error: "Please provide a valid delivery county and town." }, { status: 400 });
    }
    const isManualTown = data.townSource === "manual";
    const resolvedTown = resolveCheckoutTown(
      data.deliveryCounty,
      isManualTown ? UNLISTED_TOWN_OPTION : data.deliveryTown,
      isManualTown ? data.deliveryTown : undefined,
    );
    if (!resolvedTown) {
      return NextResponse.json({ ok: false, error: "Please select a valid delivery town or enter your area." }, { status: 400 });
    }
    resolvedDeliveryZone = resolvedTown.zone.id;
    deliveryLocation = {
      county: data.deliveryCounty.trim(),
      town: resolvedTown.town,
      townSource: resolvedTown.townSource,
      nearestMajorTown: isManualTown ? data.nearestMajorTown?.trim() || null : null,
    };
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
  const isShopPickup = data.deliveryMethod.toLowerCase().includes("pickup");
  let deliveryFee: number | null = isShopPickup ? 0 : null;

  if (resolvedDeliveryZone && !isShopPickup) {
    const opsProductIds = Array.from(
      new Set(
        items
          .map((item) => item.productId)
          .filter((productId): productId is string => Boolean(productId)),
      ),
    );
    const configuredProducts = opsProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: opsProductIds } },
          select: {
            id: true,
            name: true,
            category: true,
            shortDescription: true,
            description: true,
            specifications: true,
            sellingPrice: true,
            catalogueConfiguration: true,
          },
        })
      : [];
    const configuredProductsById = new Map(configuredProducts.map((product) => [product.id, product]));
    deliveryFee = items.reduce((highestFee, item) => {
      const storefrontProduct = productMap.get(item.cartProductId);
      const configuredProduct = item.productId ? configuredProductsById.get(item.productId) : null;
      const parsedPolicy = configuredProduct
        ? productCatalogueConfigurationSchema.safeParse(configuredProduct.catalogueConfiguration)
        : null;
      const policy = parsedPolicy?.success
        ? parsedPolicy.data
        : configuredProduct
          ? inferLegacyProductCataloguePolicy(configuredProduct)
          : storefrontProduct
            ? inferLegacyProductCataloguePolicy(storefrontProduct)
            : null;
      const transport = policy
        ? calculateTransportFee(resolvedDeliveryZone, policy)
        : { amount: getDefaultTransportFee(resolvedDeliveryZone) };
      return Math.max(highestFee, Number(transport.amount ?? 0));
    }, 0);
  }
  const total = subtotal + (deliveryFee ?? 0);
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
      deliveryFee,
      total,
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
        deliveryZone: resolvedDeliveryZone ?? null,
        deliveryCounty: deliveryLocation?.county ?? null,
        deliveryTown: deliveryLocation?.town ?? null,
        townSource: deliveryLocation?.townSource ?? null,
        nearestMajorTown: deliveryLocation?.nearestMajorTown ?? null,
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

  await notifyAdminCriticalSms({
    eventType: "WEB_ORDER_CREATED",
    entityId: created.id,
    title: `New web order ${createdRow.orderRef}`,
    details: [
      `Customer: ${createdRow.customerName}`,
      `Total: KSh ${Number(createdRow.total).toLocaleString("en-KE")}`,
      `Payment: ${createdRow.paymentMethod}`,
      `Delivery: ${createdRow.deliveryMethod}`,
      `Location: ${createdRow.customerLocation}`,
    ],
    actionPath: `/admin/receipts?tab=website-orders&orderId=${encodeURIComponent(created.id)}`,
    payload: { orderRef: createdRow.orderRef, status: createdRow.status },
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
  if (shouldUseOpsOrderStore(request)) {
    return proxyOrderRequestToOps(request);
  }

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
