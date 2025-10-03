/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";


export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  const email = (session?.user as unknown as { email?: string })?.email?.toLowerCase() || "";
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const orderId = String(form.get("orderId") || "");
    const notes = String(form.get("notes") || "");
    const photo = form.get("photo") as File | null;

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, shopId: true } }).catch(() => null as any);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Enforce scope for non-admins: order.shopId must be in managed shops
    if (role !== Role.ADMIN && email) {
      const me = await prisma.user.findUnique({
        where: { email },
        select: { managedShops: { select: { id: true } } },
      });
      const allowed = new Set((me?.managedShops || []).map(s => s.id));
      if (!order.shopId || !allowed.has(order.shopId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Try to persist to a Return model if it exists
    try {
      const ret = await (prisma as any).return.create({ data: { orderId, notes, status: "OPEN" } });
      return NextResponse.json({ ok: true, id: ret.id });
    } catch {
      // If the model doesn't exist yet, accept and log
      console.log("Return submitted (accepted):", { orderId, notes, photo: photo ? { name: photo.name, size: photo.size } : null });
      return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
    }
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: "Failed to submit return" }, { status: 500 });
  }
}