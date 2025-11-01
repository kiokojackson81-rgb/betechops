import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const count = await prisma.returnCase.count({
      where: {
        status: "pickup_scheduled",
        OR: [
          { updatedAt: { gte: sevenDaysAgo } },
          { createdAt: { gte: sevenDaysAgo } },
        ],
      },
    });
    return NextResponse.json({ count, window: { from: sevenDaysAgo.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ count: 0, error: msg }, { status: 200 });
  }
}
