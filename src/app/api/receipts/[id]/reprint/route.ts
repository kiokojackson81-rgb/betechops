import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext) {
  const params = context.params;
  return typeof (params as Promise<{ id: string }>).then === "function"
    ? await (params as Promise<{ id: string }>)
    : (params as { id: string });
}

export async function POST(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (reason.length < 3) {
    return NextResponse.json({ error: "A reprint reason is required." }, { status: 400 });
  }

  const actorId = (guard.session.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      id: true,
      receiptNumber: true,
      generatedAt: true,
      issuedById: true,
      order: { select: { orderNumber: true, attendantId: true, customerName: true, totalAmount: true } },
    },
  });
  if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

  const ownsReceipt = actorId === receipt.issuedById || actorId === receipt.order?.attendantId;
  if (guard.role === "ATTENDANT" && !ownsReceipt) {
    return NextResponse.json({ error: "You can only reprint receipts you created." }, { status: 403 });
  }

  await prisma.actionLog.create({
    data: {
      actorId,
      entity: "Receipt",
      entityId: receipt.id,
      action: "REPRINT",
      before: {
        receiptNumber: receipt.receiptNumber ?? receipt.order?.orderNumber ?? null,
        generatedAt: receipt.generatedAt.toISOString(),
      },
      after: {
        reason,
        customerName: receipt.order?.customerName ?? null,
        totalAmount: Number(receipt.order?.totalAmount ?? 0),
        reprintedAt: new Date().toISOString(),
        paymentChanged: false,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
