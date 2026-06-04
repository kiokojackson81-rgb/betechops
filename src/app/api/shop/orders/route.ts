import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteOrderRef,
  deriveWebsiteOrderType,
  ensureWebsiteOrdersSchema,
  serializeWebsiteOrder,
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = websiteOrderCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid order payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  await ensureWebsiteOrdersSchema();
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
      productId: product.opsProductId ?? (product.source === "mock" ? null : product.id),
      productName: product.name,
      quantity,
      unitPrice,
      total: unitPrice * quantity,
      sku: null,
      category: product.category ?? null,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const created = await prisma.websiteOrder.create({
    data: {
      id: buildEntityId(),
      orderRef,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      customerLocation: data.customerLocation.trim(),
      customerEmail: data.customerEmail?.trim() || null,
      deliveryMethod: data.deliveryMethod.trim(),
      paymentMethod: data.paymentMethod.trim(),
      orderType,
      status: "PENDING",
      subtotal,
      total: subtotal,
      notes: data.notes?.trim() || null,
      source: "WEBSITE",
      metadata: {
        checkoutSource: "shop",
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
    include: websiteOrderAdminInclude,
  });

  return NextResponse.json({
    ok: true,
    source: "website",
    orderRef: created.orderRef,
    status: created.status,
    successUrl: getShopOrderSuccessHref(created.orderRef),
    order: serializeWebsiteOrder(created),
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

    const serialized = serializeWebsiteOrder(order);
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
      },
    });
  }

  return NextResponse.json({ ok: true, message: "Use POST /api/shop/orders to place website orders." });
}
