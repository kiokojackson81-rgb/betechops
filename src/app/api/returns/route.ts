import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const orderId = String(form.get("orderId") || "");
    const notes = String(form.get("notes") || "");
    const photo = form.get("photo") as File | null;

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    // Validate order exists
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // TODO: Store return data in database when AuditLog table is migrated
    // For now, just log the return submission
    const s = getSession();
    console.log(`Return submitted for order ${orderId} by ${s?.role}:${s?.id}`, {
      notes,
      photo: photo ? { name: photo.name, type: photo.type, size: photo.size } : null,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: "Failed to submit return" }, { status: 500 });
  }
}