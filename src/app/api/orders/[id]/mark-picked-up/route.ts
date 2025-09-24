import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "FULFILLED",           // picked up
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, id: updated.id });
  } catch (e: unknown) {
    console.error("mark-picked-up error:", e);
    return NextResponse.json({ error: "Failed to mark picked up" }, { status: 500 });
  }
}