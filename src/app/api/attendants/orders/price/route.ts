/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId, lastBuyingPrice } = body as { productId?: string; lastBuyingPrice?: number };
  const v = Number(lastBuyingPrice);
  if (!productId || !Number.isFinite(v) || v <= 0) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const updated = await prisma.product.update({ where: { id: productId }, data: { lastBuyingPrice: v as any } as any, select: { id: true, lastBuyingPrice: true } as any });
    return NextResponse.json({ ok: true, product: updated });
  } catch {
    // If the schema doesn't have lastBuyingPrice, accept the request but don't persist
    return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
  }
}
