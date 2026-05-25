import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteOrderRef,
  deriveWebsiteOrderType,
  serializeWebsiteOrder,
  websiteOrderAdminInclude,
  websiteOrderCreateSchema,
} from "@/lib/websiteOrders";
import { getShopProducts } from "@/app/shop/shopApi";

export const dynamic = "force-dynamic";

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
      productId: product.id,
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
    successUrl: `/shop/order-success?ref=${encodeURIComponent(created.orderRef)}`,
    order: serializeWebsiteOrder(created),
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Use POST /api/shop/orders to place website orders." });
}
