import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

const normalizeName = (value: string) => value.trim().toLowerCase();

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const { accountIds } = await getMarketplaceAssignmentsForUser(auth.user.id);
  if (!accountIds.length) {
    return NextResponse.json({ orders: [] });
  }

  const url = new URL(req.url);
  const take = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  const statusFilter = url.searchParams.get("status") ?? "all";

  const whereBase: any = {
    accountId: { in: accountIds },
    buyingPrice: null,
  };

  if (statusFilter && statusFilter !== "all") {
    const sf = String(statusFilter).toUpperCase();
    whereBase.status = sf;
  }

  const orders = await prisma.marketplaceOrder.findMany({
    where: whereBase,
    include: { account: true },
    orderBy: { orderedAt: "desc" },
    take,
  });

  if (!orders.length) return NextResponse.json({ orders: [] });

  const templateKeys: string[] = Array.from(
    new Set(
      orders.map(
        (order: any) =>
          `${order.platform}:${normalizeName(order.productName)}:${Number(order.sellingPrice ?? 0)}`,
      ),
    ),
  );

  const templates = templateKeys.length
    ? await prisma.marketplacePricingTemplate.findMany({
        where: {
          OR: templateKeys.map((key) => {
            const [platform, name, price] = (key as string).split(":");
            return {
              platform: platform as any,
              normalizedProductName: name,
              sellingPrice: Number(price),
            };
          }),
        },
      })
    : [];

  const templateMap = new Map<string, number>();
  templates.forEach((template: any) => {
    const mapKey = `${template.platform}:${template.normalizedProductName}:${Number(template.sellingPrice ?? 0)}`;
    templateMap.set(mapKey, Number(template.defaultBuyingPrice ?? 0));
  });

  return NextResponse.json({
    orders: orders.map((order: any) => {
      const key = `${order.platform}:${normalizeName(order.productName)}:${Number(order.sellingPrice ?? 0)}`;
      return {
        id: order.id,
        accountId: order.accountId,
        accountName: order.account.displayName,
        platform: order.platform,
        orderId: order.orderId,
        orderItemId: order.orderItemId,
        status: order.status,
        orderedAt: order.orderedAt.toISOString(),
        productName: order.productName,
        productUrl: order.productUrl,
        sellingPrice: Number(order.sellingPrice ?? 0),
        currency: order.currency,
        suggestedBuyingPrice: templateMap.get(key) ?? null,
        // Extract fees from stored raw payload when available to show in UI
        sellerFee: Number(((order.rawPayload as any)?.seller_fee?.amount ?? (order.rawPayload as any)?.seller_fee_amount) ?? 0),
        shippingFee: Number(((order.rawPayload as any)?.shipping_fee?.amount ?? (order.rawPayload as any)?.shipping_fee_amount) ?? 0),
      };
    }),
  });
}
