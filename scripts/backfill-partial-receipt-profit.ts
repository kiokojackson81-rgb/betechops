import { prisma } from "../src/lib/prisma.ts";
import { computeRecognizedReceiptProfit } from "../src/lib/recognizedReceiptProfit.ts";
import { recomputeOrderEconomics } from "../src/lib/recomputeOrderEconomics.ts";

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      receipt: {
        isNot: null,
      },
    },
    select: {
      id: true,
      orderNumber: true,
      items: {
        select: {
          quantity: true,
          sellingPrice: true,
          orderCosts: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { unitCost: true },
          },
        },
      },
      receipt: {
        select: {
          id: true,
          totals: true,
        },
      },
    },
  });

  let scanned = 0;
  let mixed = 0;
  let updated = 0;

  for (const order of orders) {
    scanned += 1;
    if (!order.receipt) continue;

    const items = order.items.map((item) => ({
      quantity: Number(item.quantity ?? 1) || 1,
      sellingPrice: Number(item.sellingPrice ?? 0),
      buyingPrice: Number(item.orderCosts[0]?.unitCost ?? 0),
    }));

    const pricedCount = items.filter((item) => item.buyingPrice > 0).length;
    const unpricedCount = items.length - pricedCount;
    if (!(pricedCount > 0 && unpricedCount > 0)) continue;

    mixed += 1;

    const storedTotals =
      order.receipt.totals && typeof order.receipt.totals === "object"
        ? (order.receipt.totals as Record<string, unknown>)
        : {};

    const storedProfit = Number(storedTotals.profit ?? 0);
    const storedBuyingTotal = Number(storedTotals.buyingTotal ?? 0);
    const aggregateSellingTotal =
      Number(storedTotals.total ?? 0) ||
      items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
    const rawBuyingTotal = items.reduce(
      (sum, item) => sum + item.buyingPrice * item.quantity,
      0,
    );
    const recognized = computeRecognizedReceiptProfit({
      items,
      aggregateSellingTotal,
      aggregateBuyingTotal: rawBuyingTotal,
    });

    if (
      Math.round(storedProfit) !== Math.round(recognized.recognizedProfit) ||
      Math.round(storedBuyingTotal) !== Math.round(rawBuyingTotal)
    ) {
      await recomputeOrderEconomics(order.id);
      updated += 1;
      console.log(
        `[backfill] updated ${order.orderNumber} (${order.receipt.id}) storedProfit=${storedProfit} recognizedProfit=${recognized.recognizedProfit}`,
      );
    }
  }

  console.log(JSON.stringify({ scanned, mixed, updated }, null, 2));
}

main()
  .catch((error) => {
    console.error("[backfill] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
