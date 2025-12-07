import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const dynamic = "force-dynamic";

const IMMEDIATE_THRESHOLD = Number(process.env.IMMEDIATE_COMMISSION_THRESHOLD || 500000);

export async function POST(req: NextRequest) {
  let guard;
  try {
    guard = await requireAttendant(req as unknown as Request);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const payload = (await req.json()) as any;

  const serial = String(payload?.serial || `R-${genId()}`);
  const docType = (String(payload?.docType || "RECEIPT")).toUpperCase();
  const attendantId = payload?.attendantId ?? payload?.servedBy ?? null;
  const issuedById = payload?.issuedById ?? (guard.ok ? guard.user.id : null);

  // compute totals
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const subtotal = items.reduce((s: number, it: any) => s + (Number(it.unitPrice || it.sellingPrice || 0) * Number(it.quantity || 1)), 0);
  const taxRate = Number(payload?.taxRate || 0);
  const taxAmount = payload?.showTax ? (subtotal * (taxRate / 100)) : 0;
  const discount = Number(payload?.discount || 0);
  const total = subtotal + taxAmount - discount;
  const deposit = docType === "LAYAWAY" ? Number(payload?.deposit || 0) : 0;
  const balance = docType === "LAYAWAY" ? Math.max(0, total - deposit) : 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // choose shop: provided or first active
      let shopId = payload?.shopId;
      if (!shopId) {
        const shop = await tx.shop.findFirst({ where: { isActive: true }, select: { id: true } });
        shopId = shop?.id ?? null;
      }
      if (!shopId) throw new Error("No active shop found for receipt");

      // ensure products exist for items (create lightweight product records if needed)
      const createdItems: any[] = [];
      for (const it of items) {
        const title = String(it.title || it.product || it.name || "Item").slice(0, 255);
        let product = await tx.product.findFirst({ where: { name: title } });
        if (!product) {
          product = await tx.product.create({ data: { sku: `manual-${genId()}`, name: title, category: "manual", sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0 } });
        }
        createdItems.push({ product, qty: Number(it.quantity || 1), unitPrice: Number(it.unitPrice || it.sellingPrice || 0), serial: it.serial, warranty: it.warranty, title });
      }

      // upsert order by orderNumber (use serial as orderNumber)
      const orderUpsert = await tx.order.upsert({
        where: { orderNumber: serial },
        create: {
          orderNumber: serial,
          customerName: payload?.customerName ?? payload?.customer ?? "",
          customerPhone: payload?.customerPhone ?? null,
          customerEmail: payload?.customerEmail ?? null,
          attendantId: attendantId ?? null,
          shopId,
          status: docType === "LAYAWAY" ? "PENDING" : "COMPLETED",
          paymentStatus: docType === "LAYAWAY" ? "PARTIAL" : "PAID",
          totalAmount: Number(total) || 0,
          paidAmount: docType === "LAYAWAY" ? deposit : Number(total) || 0,
          metadata: payload?.metadata ?? null,
        },
        update: {
          customerName: payload?.customerName ?? undefined,
          customerPhone: payload?.customerPhone ?? undefined,
          customerEmail: payload?.customerEmail ?? undefined,
          attendantId: attendantId ?? undefined,
          totalAmount: Number(total) || undefined,
          paidAmount: docType === "LAYAWAY" ? deposit : Number(total) || undefined,
          status: docType === "LAYAWAY" ? "PENDING" : "COMPLETED",
          paymentStatus: docType === "LAYAWAY" ? "PARTIAL" : "PAID",
          metadata: payload?.metadata ?? undefined,
        },
      });

      // clear existing order items for update case (simple approach)
      await tx.orderItem.deleteMany({ where: { orderId: orderUpsert.id } });

      for (const it of createdItems) {
        await tx.orderItem.create({
          data: {
            orderId: orderUpsert.id,
            productId: it.product.id,
            quantity: it.qty,
            sellingPrice: Number(it.unitPrice || 0),
            serial: it.serial ?? null,
            warranty: it.warranty ?? null,
          },
        });
      }

      // Layaway plan creation/update
      if (docType === "LAYAWAY") {
        const existingPlan = await tx.layawayPlan.findUnique({ where: { orderId: orderUpsert.id } });
        if (existingPlan) {
          await tx.layawayPlan.update({
            where: { id: existingPlan.id },
            data: {
              deposit,
              balance,
              isComplete: balance <= 0,
            },
          });
        } else {
          await tx.layawayPlan.create({
            data: {
              orderId: orderUpsert.id,
              deposit,
              balance,
              isComplete: balance <= 0,
              payments: deposit > 0 ? { create: { amount: deposit, method: payload?.depositMethod ?? "CASH", ref: payload?.depositRef ?? null } } : undefined,
            },
          });
        }
      }

      // create or update receipt
      const receiptData = {
        orderId: orderUpsert.id,
        docType: docType as any,
        issuedById: issuedById ?? null,
        taxRate: payload?.taxRate ? String(payload.taxRate) : undefined,
        discount: payload?.discount ? String(payload.discount) : undefined,
        showTax: Boolean(payload?.showTax),
        showDiscount: Boolean(payload?.showDiscount),
        paymentDetailsShown: Boolean(payload?.paymentDetailsShown),
        notes: payload?.notes ?? null,
        warrantyText: payload?.warrantyText ?? null,
        totals: { subtotal, tax: taxAmount, total, balance },
        data: {
          ...payload,
          orderRef: serial,
          totals: { subtotal, tax: taxAmount, total, balance },
          attendantId,
          issuedById,
          items,
        },
      } as any;

      // upsert receipt by orderId
      const existingReceipt = await tx.receipt.findUnique({ where: { orderId: orderUpsert.id } });
      let receipt;
      if (existingReceipt) {
        receipt = await tx.receipt.update({ where: { id: existingReceipt.id }, data: receiptData });
      } else {
        receipt = await tx.receipt.create({ data: receiptData });
      }

      // create provisional commission record
      const provisional = await tx.commissionRecord.create({
        data: {
          orderId: orderUpsert.id,
          attendantId: attendantId ?? null,
          amount: null,
          status: "PENDING",
          data: { subtotal, tax: taxAmount, total, docType },
        },
      });

      // Optionally release immediately if threshold met
      if (Number(total) >= IMMEDIATE_THRESHOLD && attendantId) {
        const { period, tiers } = await getOrCreateCommissionPeriod(new Date());
        const totalsAgg = await tx.order.aggregate({
          where: { attendantId, createdAt: { gte: period.startDate, lte: period.endDate }, status: "COMPLETED" },
          _sum: { totalAmount: true, paidAmount: true },
        });
        const totalSales = Number(totalsAgg._sum.totalAmount ?? 0);
        const totalProfit = totalSales; // fallback; real profit calc omitted here
        const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers as any);
        await tx.commissionRecord.update({
          where: { id: provisional.id },
          data: { amount: String(salesCommission), status: "RELEASED", releasedAt: new Date(), periodId: period.id },
        });
        // Upsert attendant balance to reflect immediate release
        if (attendantId) {
          await tx.balance.upsert({
            where: { userId: attendantId },
            create: { userId: attendantId, available: Number(salesCommission), pending: 0 },
            update: { available: { increment: Number(salesCommission) } as any },
          });
        }

        // Create a CommissionLedger entry for audit
        try {
          await tx.commissionLedger.create({
            data: {
              userId: attendantId,
              periodStart: period.startDate,
              periodEnd: period.endDate,
              grossCommission: Number(salesCommission),
              penalties: 0,
              netCommission: Number(salesCommission),
              detail: { reason: "Immediate release on threshold" },
            },
          });
        } catch (e) {
          console.error("Failed to create CommissionLedger entry", e);
        }
      }

      return { orderRef: orderUpsert.orderNumber, receiptId: receipt.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
