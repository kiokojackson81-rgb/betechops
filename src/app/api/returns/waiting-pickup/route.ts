import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await prisma.returnCase.count({
      where: { status: "pickup_scheduled" },
    });
    return NextResponse.json({ count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ count: 0, error: msg }, { status: 200 });
  }
}
