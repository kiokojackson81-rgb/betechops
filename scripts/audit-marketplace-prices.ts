import { prisma } from "../src/lib/prisma.ts";
import { getTradingPeriodFor } from "../src/lib/tradingPeriod.ts";

async function main() {
  const period = getTradingPeriodFor(new Date());
  console.log(`Checking marketplace orders for ${period.label} (${period.start.toISOString()} → ${period.end.toISOString()})`);

  const [total, missing] = await Promise.all([
    prisma.marketplaceOrder.count({
      where: {
        orderedAt: { gte: period.start, lte: period.end },
      },
    }),
    prisma.marketplaceOrder.count({
      where: {
        orderedAt: { gte: period.start, lte: period.end },
        buyingPrice: null,
      },
    }),
  ]);

  if (total === 0) {
    console.log("No marketplace orders recorded in the current period.");
  } else {
    console.log(`Total marketplace orders: ${total}`);
    console.log(`Orders missing buying price: ${missing}`);
  }

  if (missing > 0) {
    const examples = await prisma.marketplaceOrder.findMany({
      where: {
        orderedAt: { gte: period.start, lte: period.end },
        buyingPrice: null,
      },
      take: 5,
      select: {
        id: true,
        orderId: true,
        platform: true,
        accountId: true,
        pricedById: true,
        orderedAt: true,
      },
      orderBy: { orderedAt: "desc" },
    });
    console.log("Examples:");
    for (const example of examples) {
      console.log(
        `  • ${example.platform} order ${example.orderId} (account ${example.accountId}) ordered at ${example.orderedAt.toISOString()} pricedBy ${example.pricedById ?? "unassigned"}`,
      );
    }
  }
}

main().catch((error) => {
  console.error("audit failed", error);
  process.exit(1);
});
