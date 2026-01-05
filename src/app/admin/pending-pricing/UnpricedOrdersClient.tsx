import { Platform } from "@prisma/client";

import { type TradingPeriod } from "@/lib/tradingPeriod";
import { prisma } from "@/lib/prisma";
import UnpricedOrdersCard from "@/app/attendant/jumia-ops/UnpricedOrdersCard";

type Props = {
  period: TradingPeriod;
};

export default async function UnpricedOrdersClient({ period }: Props) {
  // Server-side: fetch unpriced marketplace orders so admin users don't need attendant session
  const rows = await prisma.marketplaceOrder.findMany({
    where: {
      platform: Platform.JUMIA,
      buyingPrice: null,
      orderedAt: {
        gte: period.start,
        lte: period.end,
      },
    },
    include: { account: true },
    orderBy: { orderedAt: "desc" },
  });

  const orders = rows.map((order: any) => ({
    id: order.id,
    accountId: order.accountId,
    accountName: order.account?.displayName ?? "",
    platform: order.platform,
    orderId: order.orderId,
    orderItemId: order.orderItemId,
    status: order.status,
    orderedAt: order.orderedAt?.toISOString(),
    productName: order.productName,
    productUrl: order.productUrl,
    sellingPrice: Number(order.sellingPrice ?? 0),
    currency: order.currency,
    suggestedBuyingPrice: null,
    sellerFee: Number(order.sellerFee ?? 0),
    shippingFee: Number(order.shippingFee ?? 0),
  }));

  // Render client component with server-provided orders and disable client fetch
  return <UnpricedOrdersCard initialOrders={orders} disableFetch />;
}
