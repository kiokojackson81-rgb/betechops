import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getSalesToday, getPendingPricingCount, getReturnsWaitingPickup } from "@/lib/jumia";

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
    const roles = [Role.ATTENDANT, Role.SUPERVISOR, Role.ADMIN];
    const [products, shops, attendants, orders] = await Promise.all([
      prisma.product.count(),
      prisma.shop.count(),
      prisma.user.count({ where: { role: { in: roles } } }),
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
      select: { quantity: true, product: { select: { lastBuyingPrice: true } } },
    });

    const buyingThisWeek = orderItems.reduce((sum: number, it) => {
      const cost = (it.product?.lastBuyingPrice ?? 0) * it.quantity;
      return sum + cost;
    }, 0);

    // Profit (gross)
    const profitThisWeek = revenueThisWeek - buyingThisWeek;

    // Jumia-derived metrics (sales today, pending pricing, returns waiting pickup)
    const [salesTodayAgg, pendingPricingAgg, returnsWaitingPickupAgg] = await Promise.all([
      getSalesToday(),
      getPendingPricingCount(),
      getReturnsWaitingPickup(),
    ]);

    const salesToday = (salesTodayAgg && typeof salesTodayAgg.total === 'number') ? salesTodayAgg.total : 0;
    const pendingPricing = (pendingPricingAgg && typeof pendingPricingAgg.count === 'number') ? pendingPricingAgg.count : 0;
    const returnsWaitingPickup = (returnsWaitingPickupAgg && typeof returnsWaitingPickupAgg.count === 'number') ? returnsWaitingPickupAgg.count : 0;

    const payload = {
      products,
      shops,
      attendants,
      orders,
      revenueThisWeek,
      buyingThisWeek,
      profitThisWeek,
      returnsWaitingPickup,
      salesToday,
      pendingPricing,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: unknown) {
    console.error("summary error:", e);
    // Return a safe shape so dashboard remains functional even when summary build fails
    return NextResponse.json({
      products: 0,
      shops: 0,
      attendants: 0,
      orders: 0,
      revenueThisWeek: 0,
      buyingThisWeek: 0,
      profitThisWeek: 0,
      returnsWaitingPickup: 0,
      salesToday: 0,
      pendingPricing: 0,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 200 });
  }
}