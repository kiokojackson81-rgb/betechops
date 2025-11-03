import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Aggregate directly from the synced database so UI counts stay stable across refreshes.
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const total = await prisma.order.count({
      where: {
        status: "PENDING",
        updatedAt: {
          gte: windowStart,
          lte: now,
        },
        shop: {
          isActive: true,
        },
      },
    });
    return NextResponse.json({
      count: total,
      window: {
        from: windowStart.toISOString(),
        to: now.toISOString(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ count: 0, error: msg }, { status: 200 });
  }
}
 
