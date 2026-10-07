import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getActorId, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recomputeOrderEconomics } from "@/lib/recomputeOrderEconomics";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext) {
  const params = context.params;
  return typeof (params as Promise<{ id: string }>).then === "function"
    ? await (params as Promise<{ id: string }>)
    : (params as { id: string });
}

/** Records a confirmed counter/payment-desk payment. This is intentionally
 * admin-only: it is not an M-Pesa callback substitute. */
export async function POST(_request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { order: { select: { id: true, totalAmount: true, paidAmount: true, paymentStatus: true, status: true } } },
  });
  if (!receipt?.order) return NextResponse.json({ error: "Receipt order not found" }, { status: 404 });

  const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
    ? (receipt.data as Record<string, unknown>)
    : {};
  const customerType = String(data.customerType ?? "").toLowerCase();
  if (customerType === "pod" || data.podDelivery) {
    return NextResponse.json({ error: "Use the POD payment action after delivery." }, { status: 400 });
  }
  if (customerType === "project" || data.projectFlow) {
    return NextResponse.json({ error: "Project payments must use the project payment workflow." }, { status: 400 });
  }
  if (["CANCELLED", "CANCELED"].includes(String(receipt.order.status).toUpperCase())) {
    return NextResponse.json({ error: "Cancelled receipts cannot be marked paid." }, { status: 400 });
  }

  const total = Number(receipt.order.totalAmount ?? 0);
  if (!(total > 0)) return NextResponse.json({ error: "Receipt total must be greater than zero." }, { status: 400 });
  if (String(receipt.order.paymentStatus).toUpperCase() === "PAID" && Number(receipt.order.paidAmount) >= total) {
    return NextResponse.json({ error: "This receipt is already marked paid." }, { status: 409 });
  }

  const actorId = (await getActorId()) ?? null;
  const actor = (guard.session?.user ?? {}) as { name?: string | null; email?: string | null };
  const actorName = actor.name ?? actor.email ?? "BetechOps admin";
  const paidAt = new Date().toISOString();
  const nextData = {
    ...data,
    manualPayment: {
      confirmedAt: paidAt,
      confirmedById: actorId,
      confirmedBy: actorName,
      source: "ADMIN_RECEIPTS",
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: receipt.order!.id },
      data: { paidAmount: total, paymentStatus: "PAID", status: "COMPLETED" },
    });
    await tx.receipt.update({ where: { id }, data: { data: nextData as Prisma.InputJsonValue } });
    if (actorId) {
      await tx.actionLog.create({
        data: {
          actorId,
          entity: "Receipt",
          entityId: id,
          action: "ADMIN_MARK_PAID",
          before: { paidAmount: receipt.order!.paidAmount, paymentStatus: receipt.order!.paymentStatus } as Prisma.InputJsonValue,
          after: { paidAmount: total, paymentStatus: "PAID", confirmedAt: paidAt } as Prisma.InputJsonValue,
        } as any,
      }).catch(() => undefined);
    }
  });

  await recomputeOrderEconomics(receipt.order.id);
  publishSummaryUpdate({ receiptId: id, timestamp: paidAt });
  return NextResponse.json({ ok: true, paidAmount: total, paymentStatus: "PAID" });
}
