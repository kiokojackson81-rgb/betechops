import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          items: true,
          attendant: { select: { id: true, name: true, email: true } },
          layawayPlan: { include: { payments: true } },
        },
      },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ receipt });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.res;
  const actorId = (guard.session?.user as any)?.id ?? null;

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? body.items : [];
  const taxRate = Number(body?.taxRate || 0);
  const showTax = Boolean(body?.showTax);
  const discount = Number(body?.discount || 0);
  const showDiscount = Boolean(body?.showDiscount);
  const paymentDetailsShown = Boolean(body?.paymentDetailsShown);
  const notes = body?.notes ?? null;
  const warrantyText = body?.warrantyText ?? null;

  const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 1) * Number(it.unitPrice || it.sellingPrice || 0), 0);
  const taxAmount = showTax ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount - discount;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.receipt.findUnique({
        where: { id: params.id },
        include: { order: { include: { items: true, layawayPlan: true } } },
      });
      if (!existing) throw new Error("Receipt not found");
      const docType = body?.docType ? String(body.docType).toUpperCase() : String(existing.docType);
      const layawayDeposit = Number(existing.order?.layawayPlan?.deposit ?? existing.order?.paidAmount ?? 0);
      const paidAmount = docType === "LAYAWAY" ? layawayDeposit : total;

      // refresh products + items
      await tx.orderItem.deleteMany({ where: { orderId: existing.orderId } });
      for (const it of items) {
        const title = String(it.title || it.product || it.productName || "Item").slice(0, 255);
        let product = await tx.product.findFirst({ where: { name: title } });
        if (!product) {
          product = await tx.product.create({
            data: {
              sku: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              name: title,
              category: "manual",
              sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0,
            },
          });
        }
        await tx.orderItem.create({
          data: {
            orderId: existing.orderId,
            productId: product.id,
            quantity: Number(it.quantity || 1),
            sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0,
            serial: it.serial ?? null,
            warranty: it.warranty ?? null,
          },
        });
      }

      // update order basics
      await tx.order.update({
        where: { id: existing.orderId },
        data: {
          customerName: body?.customerName ?? undefined,
          customerPhone: body?.customerPhone ?? undefined,
          customerEmail: body?.customerEmail ?? undefined,
          attendantId: body?.attendantId ?? undefined,
          totalAmount: total,
          paidAmount,
        },
      });

      if (existing.order?.layawayPlan) {
        const balance = Math.max(0, total - Number(existing.order.layawayPlan.deposit || 0));
        await tx.layawayPlan.update({
          where: { id: existing.order.layawayPlan.id },
          data: { balance, isComplete: balance <= 0 },
        });
      }

      const updatedReceipt = await tx.receipt.update({
        where: { id: params.id },
        data: {
          taxRate: taxRate || null,
          discount: discount || null,
          showTax,
          showDiscount,
          paymentDetailsShown,
          notes,
          warrantyText,
          totals: {
            subtotal,
            tax: taxAmount,
            total,
            balance: existing.order?.layawayPlan ? Math.max(0, total - Number(existing.order.layawayPlan.deposit || 0)) : 0,
          },
          data: { ...(existing.data as any), ...body, totals: { subtotal, tax: taxAmount, total } },
        },
      });

      try {
        await tx.actionLog.create({
          data: {
            actorId: actorId ?? "system",
            entity: "Receipt",
            entityId: params.id,
            action: "UPDATE",
            before: existing as any,
            after: updatedReceipt as any,
          },
        });
      } catch {
        // best-effort audit log
      }

      return updatedReceipt;
    });

    return NextResponse.json({ ok: true, receipt: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update receipt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
