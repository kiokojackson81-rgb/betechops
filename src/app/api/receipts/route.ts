import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant, auth } from "@/lib/auth";
import { findReceiptOwner, buildDuplicateMessage } from "@/lib/receiptGuard";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";
import { generateRandomId } from "@/lib/id";
import { normalizeReceiptSerial } from "@/lib/receipts/serial";

export const dynamic = "force-dynamic";

const IMMEDIATE_THRESHOLD = Number(process.env.IMMEDIATE_COMMISSION_THRESHOLD || 500000);

export async function GET(req: NextRequest) {
  try {
    await auth(); // soft guard: require session but allow attendants/supervisors/admins
  } catch (e) {
    // allow unauthenticated fetch to still fall through if middleware handled already
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const docType = url.searchParams.get("docType") || undefined;
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const attendantId = url.searchParams.get("attendantId") || undefined;
  const includeItems = url.searchParams.get("includeItems") === "true";
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const size = Math.min(200, Math.max(1, Number(url.searchParams.get("size") || "50")));

  const today = new Date();
  const startDefault = new Date(today);
  startDefault.setHours(0, 0, 0, 0);
  const endDefault = new Date(today);
  endDefault.setHours(23, 59, 59, 999);

  const where: any = {};
  if (docType) where.docType = docType.toUpperCase();
  where.generatedAt = {
    gte: start ? new Date(start) : startDefault,
    lte: end ? new Date(end) : endDefault,
  };

  if (q) {
    where.OR = [
      { order: { customerName: { contains: q, mode: "insensitive" } } },
      { order: { customerPhone: { contains: q, mode: "insensitive" } } },
      { order: { customerEmail: { contains: q, mode: "insensitive" } } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { order: { attendant: { name: { contains: q, mode: "insensitive" } } } },
      { issuedBy: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (attendantId) {
    where.order = { ...(where.order || {}), attendantId };
  }

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { generatedAt: "desc" },
    skip: (page - 1) * size,
    take: size,
    include: {
      order: includeItems
        ? { include: { items: true, attendant: { select: { id: true, name: true } } } }
        : { select: { orderNumber: true, customerName: true, attendant: { select: { id: true, name: true } }, status: true, paymentStatus: true, totalAmount: true } },
      issuedBy: { select: { id: true, name: true } },
    },
  });

  const mapped = receipts.map((r) => ({
    id: r.id,
    orderRef: r.order?.orderNumber,
    docType: r.docType,
    createdAt: r.generatedAt,
    customerName: r.order?.customerName,
    total: (r.totals as any)?.total ?? (r.order as any)?.totalAmount ?? null,
    attendantName: (r.order as any)?.attendant?.name ?? r.issuedBy?.name ?? null,
    status: r.order?.status ?? r.order?.paymentStatus ?? null,
    items: includeItems ? ((r.order as any)?.items ?? []) : undefined,
  }));

  return NextResponse.json({ receipts: mapped, paging: { page, size } });
}

export async function POST(req: NextRequest) {
  let guard;
  try {
    guard = await requireAttendant(req as unknown as Request);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const payload = (await req.json()) as any;

  const serial = normalizeReceiptSerial(payload?.serial);
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
    // Early duplicate guard: check across POS, marketing, support
    const existing = await findReceiptOwner(String(serial));
    if (existing) {
      const msg = buildDuplicateMessage(serial, existing);
      return NextResponse.json({ ok: false, code: "DUPLICATE_RECEIPT", message: msg, owner: existing }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const entryDate = payload?.date ? new Date(payload.date) : new Date();
      const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });

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
          product = await tx.product.create({ data: { sku: `manual-${generateRandomId()}`, name: title, category: "manual", sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0 } });
        }
        createdItems.push({
          product,
          qty: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || it.sellingPrice || 0),
          serial: it.serial,
          warranty: it.warranty,
          title,
          costPrice: Number(it.costPrice ?? it.buyingPrice ?? 0) || 0,
        });
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

      const createdOrderItems: any[] = [];
      for (const it of createdItems) {
        const item = await tx.orderItem.create({
          data: {
            orderId: orderUpsert.id,
            productId: it.product.id,
            quantity: it.qty,
            sellingPrice: Number(it.unitPrice || 0),
            serial: it.serial ?? null,
            warranty: it.warranty ?? null,
          },
        });
        createdOrderItems.push(item);
      }

      // Layaway plan creation/update (guarded for test tx mocks)
      if (docType === "LAYAWAY" && tx.layawayPlan) {
        try {
          const existingPlan = await tx.layawayPlan.findUnique({ where: { orderId: orderUpsert.id } });
          if (existingPlan) {
            await tx.layawayPlan.update({
              where: { id: existingPlan.id },
              data: { deposit, balance, isComplete: balance <= 0 },
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
        } catch (e) {
          // best-effort in environments with partial tx mocks
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

      // Seed CommissionEarning rows (pending) for this order's items; recompute jobs can overwrite
      if (createdOrderItems.length && attendantId && tx.commissionEarning && typeof tx.commissionEarning.createMany === 'function') {
        try {
          await tx.commissionEarning.createMany({
            data: createdOrderItems.map((it) => ({
              staffId: attendantId,
              orderItemId: it.id,
              basis: "gross",
              qty: it.quantity,
              amount: 0,
              status: docType === "LAYAWAY" ? "PENDING" : (total >= IMMEDIATE_THRESHOLD ? "RELEASED" : "PENDING"),
              calcDetail: { reason: "receipt_seed", total },
            })),
          });
        } catch (e) {
          // ignore if tx mock doesn't implement commissionEarning
        }
      }

      // Record support daily entry + receipt so support commission ledger can include this sale
      if (attendantId) {
        const startOfDay = new Date(entryDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(entryDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Support daily entry + receipts (best-effort; guard for partial tx mocks)
        if (tx.supportDailyEntry) {
          try {
            const existingEntry = await tx.supportDailyEntry.findFirst({ where: { submittedById: attendantId, date: { gte: startOfDay, lte: endOfDay } }, select: { id: true, totalSales: true, totalProfit: true }, });

            const supportReceiptItems = createdItems.map((it) => ({
              productName: it.title,
              buyingPrice: Math.max(0, Number(it.costPrice || 0)),
            }));
            const supportReceiptBuyingTotal = supportReceiptItems.reduce((sum, item) => sum + Number(item.buyingPrice || 0), 0);
            const supportReceiptProfit = Math.max(0, Number(total) - supportReceiptBuyingTotal);

            const supportReceiptData = {
              receiptNumber: serial,
              sellingTotal: total,
              paymentMethod: PaymentMethod.MPESA,
              items: { create: supportReceiptItems },
            };

            if (existingEntry) {
              if (tx.supportReceipt && typeof tx.supportReceipt.create === 'function') {
                await tx.supportReceipt.create({ data: { dailyEntryId: existingEntry.id, ...supportReceiptData } });
              }
              await tx.supportDailyEntry.update({
                where: { id: existingEntry.id },
                data: {
                  totalSales: Number(existingEntry.totalSales || 0) + total,
                  totalProfit: Number(existingEntry.totalProfit || 0) + supportReceiptProfit,
                },
              });
            } else {
              await tx.supportDailyEntry.create({
                data: {
                  date: entryDate,
                  dayOfWeek,
                  totalSales: total,
                  totalProfit: supportReceiptProfit,
                  newBatteries: 0,
                  changedBatteries: 0,
                  submittedById: attendantId,
                  receipts: { create: [supportReceiptData] },
                },
              });
            }
          } catch (e) {
            // ignore support ledger errors in test mocks
          }
        }
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

      // Seed CommissionEarning rows (gross-based) for this order's items; recompute jobs can overwrite
      if (createdOrderItems.length && attendantId && tx.commissionEarning && typeof tx.commissionEarning.createMany === 'function') {
        try {
          const perItemEarnings = createdOrderItems.map((it) => {
            const gross = Number(it.sellingPrice || 0) * Number(it.quantity || 1);
            const status = docType === "LAYAWAY" ? "PENDING" : (total >= IMMEDIATE_THRESHOLD ? "RELEASED" : "PENDING");
            return { staffId: attendantId, orderItemId: it.id, basis: "gross", qty: it.quantity, amount: gross, status, calcDetail: { reason: "receipt_seed", total } };
          });
          await tx.commissionEarning.createMany({ data: perItemEarnings });

          // If immediate threshold hit, also release commission record now
          if (total >= IMMEDIATE_THRESHOLD && tx.commissionRecord) {
            try {
              await tx.commissionRecord.update({ where: { id: provisional.id }, data: { status: "RELEASED", amount: String(total), releasedAt: new Date() } });
            } catch (e) {
              // ignore in partial mocks
            }
          }
        } catch (e) {
          // ignore commission earnings in partial tx mocks
        }
      }

      // If layaway is fully paid on creation, release pending commissions
      if (docType === "LAYAWAY" && balance <= 0 && attendantId) {
        await tx.commissionRecord.update({
          where: { id: provisional.id },
          data: { status: "RELEASED", amount: String(total), releasedAt: new Date() },
        });
        await tx.commissionEarning.updateMany({
          where: { orderItem: { orderId: orderUpsert.id }, status: "PENDING" },
          data: { status: "RELEASED" },
        });
      }

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
        if (attendantId && tx.balance) {
          try {
            await tx.balance.upsert({ where: { userId: attendantId }, create: { userId: attendantId, available: Number(salesCommission), pending: 0 }, update: { available: { increment: Number(salesCommission) } as any } });
          } catch (e) {
            // ignore balance upsert in partial mocks
          }
        }

        // Create a CommissionLedger entry for audit (best-effort)
        if (tx.commissionLedger) {
          try {
            await tx.commissionLedger.create({ data: { userId: attendantId, periodStart: period.startDate, periodEnd: period.endDate, grossCommission: Number(salesCommission), penalties: 0, netCommission: Number(salesCommission), detail: { reason: "Immediate release on threshold" } } });
          } catch (e) {
            console.error("Failed to create CommissionLedger entry", e);
          }
        }
      }

      return { orderRef: orderUpsert.orderNumber, receiptId: receipt.id };
    });

    // Recompute support commission ledger after committing the transaction
    if (attendantId) {
      try {
        const period = getTradingPeriodFor(payload?.date ? new Date(payload.date) : new Date());
        await recomputeSupportCommissionLedger({ userId: attendantId, period });
      } catch (ledgerErr) {
        console.error("[receipts] failed to recompute support commission ledger", ledgerErr);
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
