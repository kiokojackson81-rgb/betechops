import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { OrderStatus } from "@prisma/client";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data = { status: OrderStatus.FULFILLED };
  try {
    await prisma.order.update({ where: { id }, data });
  } catch {
    // fallback to COMPLETED if FULFILLED update fails
    await prisma.order.update({ where: { id }, data: { status: OrderStatus.COMPLETED } }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
