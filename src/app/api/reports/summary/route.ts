import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Week window (Mon 00:00 → Sun 23:59) in Africa/Nairobi without adding deps.
 * We compute in UTC but align boundaries to Nairobi (UTC+3).
 */
function getThisWeekRangeNairobi() {
  const now = new Date();

  // Shift to Nairobi "local" by +3h
  const nairobiMs = now.getTime() + 3 * 60 * 60 * 1000;
  const nairobiNow = new Date(nairobiMs);

  // Find Monday of this week (0=Sun,1=Mon,...)
  const day = nairobiNow.getUTCDay();
  const diffToMonday = (day + 6) % 7; // Mon=1 → 0, Sun=0 → 6
  const start = new Date(
    Date.UTC(
      nairobiNow.getUTCFullYear(),
      nairobiNow.getUTCMonth(),
      nairobiNow.getUTCDate() - diffToMonday,
      0, 0, 0, 0
    )
  );
  // Convert boundaries back to UTC time by -3h
  const startUTC = new Date(start.getTime() - 3 * 60 * 60 * 1000);

  // End = start + 7 days
  const endUTC = new Date(startUTC.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { startUTC, endUTC };
}

export async function GET() {
  try {
    const { startUTC, endUTC } = getThisWeekRangeNairobi();

    // Parallel simple counts
    const [products, shops, attendants, orders] = await Promise.all([
      prisma.product.count(),
      prisma.shop.count(),
      prisma.attendant.count(),
      prisma.order.count(),
    ]);

    // Revenue this week: sum of paidAmount for orders created this week
    const revenueAgg = await prisma.order.aggregate({
      where: { createdAt: { gte: startUTC, lt: endUTC } },
      _sum: { paidAmount: true },
    });
    const revenueThisWeek = revenueAgg._sum.paidAmount ?? 0;

    // Buying this week:
    // Sum(Product.actualPrice * OrderItem.quantity) for items whose parent order was created this week
    const orderItems = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: startUTC, lt: endUTC } } },
      select: { quantity: true, product: { select: { actualPrice: true } } },
    });

    const buyingThisWeek = orderItems.reduce((sum: number, it: { quantity: number; product: { actualPrice: number } | null }) => {
      const cost = (it.product?.actualPrice ?? 0) * it.quantity;
      return sum + cost;
    }, 0);

    // Profit (gross)
    const profitThisWeek = revenueThisWeek - buyingThisWeek;

    // Returns waiting pickup:
    // If you track returns as OrderStatus=RETURNED, count them for this week.
    // Adjust if you later add a dedicated Returns model/status.
    const returnsWaitingPickup = await prisma.order.count({
      where: {
        status: "RETURNED",
        createdAt: { gte: startUTC, lt: endUTC },
      },
    });

    const payload = {
      products,
      shops,
      attendants,
      orders,
      revenueThisWeek,
      buyingThisWeek,
      profitThisWeek,
      returnsWaitingPickup,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: unknown) {
    console.error("summary error:", e);
    return NextResponse.json({ error: "Failed to build summary" }, { status: 500 });
  }
}