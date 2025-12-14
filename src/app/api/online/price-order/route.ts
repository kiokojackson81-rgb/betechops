import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

type PricePayload = {
  orderItemId: string;
  buyingPrice: number;
};

const normalizeName = (value: string) => value.trim().toLowerCase();

export async function POST(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  let payload: PricePayload | null = null;
  try {
    payload = (await req.json()) as PricePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.orderItemId) {
    return NextResponse.json({ error: "orderItemId is required" }, { status: 400 });
  }

  const buyingPrice = Number(payload.buyingPrice);
  if (!Number.isFinite(buyingPrice) || buyingPrice <= 0) {
    return NextResponse.json({ error: "buyingPrice must be a positive number" }, { status: 400 });
  }

  const order = await prisma.marketplaceOrder.findFirst({
    where: { orderItemId: payload.orderItemId },
    include: { account: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order item not found" }, { status: 404 });
  }

  const { accountIds } = await getMarketplaceAssignmentsForUser(auth.user.id);
  const hasAccess = accountIds.includes(order.accountId);
  if (!hasAccess && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rounded = Math.round(buyingPrice);
  const sellingPrice = Number(order.sellingPrice ?? 0);
  const profit = sellingPrice - rounded;

  await prisma.marketplaceOrder.update({
    where: { id: order.id },
    data: {
      buyingPrice: rounded,
      profit,
      pricedById: auth.user.id,
      pricedAt: new Date(),
    },
  });

  const normalizedName = normalizeName(order.productName);
  await prisma.marketplacePricingTemplate.upsert({
    where: {
      platform_normalizedProductName_sellingPrice: {
        platform: order.platform,
        normalizedProductName: normalizedName,
        sellingPrice: sellingPrice,
      },
    },
    create: {
      platform: order.platform,
      normalizedProductName: normalizedName,
      sellingPrice,
      defaultBuyingPrice: rounded,
      updatedById: auth.user.id,
    },
    update: {
      defaultBuyingPrice: rounded,
      updatedById: auth.user.id,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    orderId: order.orderId,
    orderItemId: order.orderItemId,
    profit,
    sellingPrice,
    buyingPrice: rounded,
  });
}
