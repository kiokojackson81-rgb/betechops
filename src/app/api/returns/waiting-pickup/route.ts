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
    const res = NextResponse.json({ count, window: { from: sevenDaysAgo.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const res = NextResponse.json({ count: 0, error: msg }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
