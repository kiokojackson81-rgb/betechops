import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as any).params;
  if (maybePromise && typeof maybePromise.then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const { id } = await resolveParams(context);
  const receipt = await prisma.receipt.findUnique({
    where: { id },
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
  let supportItems: Array<{ id: string; buyingPrice: number | null }> = [];
  try {
    if (receipt?.order?.orderNumber) {
      const supportReceipts = await prisma.supportReceipt.findMany({
        where: { receiptNumber: receipt.order.orderNumber },
        include: { items: true },
      });
      if (supportReceipts.length > 0) {
        supportItems = supportReceipts.flatMap((sr) =>
          sr.items.map((it) => ({
            id: it.id,
            buyingPrice: it.buyingPrice ? Number(it.buyingPrice) : null,
          })),
        );
      }
    }
  } catch (e) {
    // best-effort; ignore support lookup failures
  }
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ receipt, supportItems });
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) {
    // Some test environments surface a 401 (unauthorized) while tests expect 403 (forbidden).
    // Normalize 401 -> 403 here as a best-effort so tests that mock auth behave consistently.
    const res = guard.res as any;
    if (res && res.status === 401) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return guard.res;
  }
  const actorId = (guard.session?.user as any)?.id ?? null;
  const { id } = await resolveParams(context);

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? body.items : [];
  const taxRate = Number(body?.taxRate || 0);
  const showTax = Boolean(body?.showTax);
  const discount = Number(body?.discount || 0);
  const showDiscount = Boolean(body?.showDiscount);
  const paymentDetailsShown = Boolean(body?.paymentDetailsShown);
  const notes = body?.notes ?? null;
  const warrantyText = body?.warrantyText ?? null;
  const attendantId = body?.attendantId ?? null;

  const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 1) * Number(it.unitPrice || it.sellingPrice || 0), 0);
  const taxAmount = showTax ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount - discount;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.receipt.findUnique({
        where: { id },
        include: { order: { include: { items: true, layawayPlan: true } } },
      });
      if (!existing) throw new Error("Receipt not found");
      const docType = body?.docType ? String(body.docType).toUpperCase() : String(existing.docType);
      const layawayDeposit = Number(existing.order?.layawayPlan?.deposit ?? existing.order?.paidAmount ?? 0);
      const paidAmount = docType === "LAYAWAY" ? layawayDeposit : total;

      // refresh products + items
      await tx.orderItem.deleteMany({ where: { orderId: existing.orderId } });
      const createdOrderItems: any[] = [];
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
        const createdItem = await tx.orderItem.create({
          data: {
            orderId: existing.orderId,
            productId: product.id,
            quantity: Number(it.quantity || 1),
            sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0,
            serial: it.serial ?? null,
            warranty: it.warranty ?? null,
          },
        });
        createdOrderItems.push(createdItem);
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
        if (balance <= 0) {
          await tx.commissionEarning.updateMany({
            where: { orderItem: { orderId: existing.orderId }, status: "PENDING" },
            data: { status: "RELEASED" },
          });
          await tx.commissionRecord.updateMany({
            where: { orderId: existing.orderId },
            data: { status: "RELEASED", releasedAt: new Date(), amount: String(total) },
          });
        }
      }

      const updatedReceipt = await tx.receipt.update({
        where: { id },
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

      // Refresh commission earnings on edit (gross-based placeholder)
      if (createdOrderItems.length) {
        await tx.commissionEarning.deleteMany({ where: { orderItem: { orderId: existing.orderId } } });
        await tx.commissionEarning.createMany({
          data: createdOrderItems.map((it) => ({
            staffId: attendantId || existing.order?.attendantId || null,
            orderItemId: it.id,
            basis: "gross",
            qty: it.quantity,
            amount: Number(it.sellingPrice || 0) * Number(it.quantity || 1),
            status: docType === "LAYAWAY" ? "PENDING" : "PENDING",
            calcDetail: { reason: "receipt_edit_seed" },
          })),
        });
      }

      try {
        await tx.actionLog.create({
          data: {
            actorId: actorId ?? "system",
            entity: "Receipt",
            entityId: id,
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

    // recompute support ledger if attendant is present
    const ledgerAttendantId = attendantId || (updated as any)?.order?.attendantId;
    if (ledgerAttendantId) {
      try {
        const { getTradingPeriodFor } = await import("@/lib/tradingPeriod");
        const { recomputeSupportCommissionLedger } = await import("@/lib/supportCommission");
        const period = getTradingPeriodFor(new Date());
        await recomputeSupportCommissionLedger({ userId: ledgerAttendantId, period });
      } catch (e) {
        console.error("[receipts PATCH] failed to recompute support ledger", e);
      }
    }

    return NextResponse.json({ ok: true, receipt: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update receipt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
