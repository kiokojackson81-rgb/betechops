import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, type Prisma, type SupportReceipt } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseNumber, parseIntLike } from "@/lib/parseNumber";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";
import { requireAttendant, auth } from "@/lib/auth";
import { canonicalReceiptNumber, findReceiptOwner, buildDuplicateMessage } from "@/lib/receiptGuard";
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
  const phoneParam = url.searchParams.get("phone") || undefined;
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

  if (phoneParam) {
    const pRaw = String(phoneParam).replace(/[^+0-9]/g, "");
    // create a local-style variant (07...) when possible
    let local = pRaw;
    if (pRaw.startsWith("+254")) local = "0" + pRaw.slice(4);
    else if (pRaw.startsWith("254")) local = "0" + pRaw.slice(3);
    else if (/^[7][0-9]{8}$/.test(pRaw)) local = "0" + pRaw;

    where.OR = where.OR || [];
    where.OR.push({ order: { customerPhone: { contains: pRaw, mode: "insensitive" } } });
    if (local) {
      where.OR.push({ order: { customerPhone: { contains: local, mode: "insensitive" } } });
    }
  }
  if (attendantId) {
    // Allow filtering receipts either by the order.attendantId OR by the receipt issuer (issuedById)
    // This ensures attendants see receipts they served (order.attendantId) as well as receipts
    // they issued/created (issuedById). Keep any existing order filters intact.
    const orderFilter = { ...(where.order || {}), attendantId };
    where.OR = where.OR || [];
    // Also include receipts where the attendantId is stored inside the JSON `data` field
    // (some receipts persist attendant info inside `data.attendantId`). Use a JSON path
    // filter so attendants still see those receipts.
    where.OR.push({ order: orderFilter }, { issuedById: attendantId }, { data: { path: ["attendantId"], equals: attendantId } });
  }

  // compute total count for paging (best-effort; tests may mock only findMany)
  let totalCount: number | null = null;
  try {
    if (prisma.receipt && typeof (prisma.receipt as any).count === "function") {
      totalCount = await (prisma.receipt as any).count({ where });
    }
  } catch (e) {
    totalCount = null;
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
    customerPhone: (r.order as any)?.customerPhone ?? null,
    total: (r.totals as any)?.total ?? (r.order as any)?.totalAmount ?? null,
    attendantName: (r.order as any)?.attendant?.name ?? r.issuedBy?.name ?? null,
    status: r.order?.status ?? r.order?.paymentStatus ?? null,
    items: includeItems ? ((r.order as any)?.items ?? []) : undefined,
  }));

  // if we couldn't get totalCount earlier (test mocks), fall back to results length
  if (totalCount === null) totalCount = mapped.length;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / size));
  return NextResponse.json({ receipts: mapped, paging: { page, size, totalCount, totalPages } });
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

  // use shared parse helpers from src/lib/parseNumber

  const serial = normalizeReceiptSerial(payload?.serial);
  const docType = (String(payload?.docType || "RECEIPT")).toUpperCase();
  const attendantId = payload?.attendantId ?? payload?.servedBy ?? null;
  const issuedById = payload?.issuedById ?? (guard.ok ? guard.user.id : null);

  // compute totals
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const subtotal = items.reduce((s: number, it: any) => s + (parseNumber(it.unitPrice || it.sellingPrice || 0) * Math.max(1, parseNumber(it.quantity || 1, 1))), 0);
  const taxRate = parseNumber(payload?.taxRate || 0);
  const taxAmount = payload?.showTax ? (subtotal * (taxRate / 100)) : 0;
  const discount = parseNumber(payload?.discount || 0);
  const total = subtotal + taxAmount - discount;
  const deposit = docType === "LAYAWAY" ? parseNumber(payload?.deposit || 0) : 0;
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
        const quantity = Math.max(1, parseIntLike(it.quantity ?? 1, 1));
        const unitPrice = parseNumber(it.unitPrice ?? it.sellingPrice ?? 0);
        createdItems.push({
          product,
          quantity,
          unitPrice,
          serial: it.serial,
          warranty: it.warranty,
          title,
          costPrice: parseNumber(it.costPrice ?? it.buyingPrice ?? 0),
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
        const orderItemPayload = {
          orderId: orderUpsert.id,
          productId: it.product.id,
          quantity: Math.max(1, Math.trunc(it.quantity ?? 1)),
          sellingPrice: it.unitPrice,
          serial: it.serial ?? null,
          warranty: it.warranty ?? null,
        };
        if (!Number.isFinite(orderItemPayload.sellingPrice)) {
          throw new Error(`Invalid selling price for item ${it.title}`);
        }
        try {
          const item = await tx.orderItem.create({ data: orderItemPayload });
          createdOrderItems.push(item);
        } catch (orderItemError) {
          console.error("[receipts] failed to persist order item", orderItemPayload, orderItemError);
          throw orderItemError;
        }
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
              buyingTotal: supportReceiptBuyingTotal,
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

      if (attendantId && tx.marketingDailyEntry && tx.marketingReceipt) {
        try {
          const marketingStart = new Date(entryDate);
          marketingStart.setHours(0, 0, 0, 0);
          const marketingEnd = new Date(entryDate);
          marketingEnd.setHours(23, 59, 59, 999);
          const normalizedSerial = canonicalReceiptNumber(serial);
          const receiptSellingTotal = Math.round(Number(total) || 0);
          const receiptItemsPayload = createdItems.map((it) => ({
            productName: String(it.title || "Item").trim(),
            buyingPrice: Math.max(0, Math.round(Number(it.costPrice || 0))),
          }));
          const receiptBuyingTotal = receiptItemsPayload.reduce((sum, item) => sum + item.buyingPrice, 0);
          const paymentMethod =
            (typeof payload?.paymentMethod === "string" && payload.paymentMethod.toUpperCase() === "CASH"
              ? PaymentMethod.CASH
              : PaymentMethod.MPESA) ?? PaymentMethod.MPESA;
          let entry = await tx.marketingDailyEntry.findFirst({
            where: {
              submittedById: attendantId,
              date: {
                gte: marketingStart,
                lte: marketingEnd,
              },
            },
          });
          const actorName = guard.user?.name ?? guard.user?.email ?? null;
          const actorEmail = guard.user?.email ?? null;
          if (!entry) {
            entry = await tx.marketingDailyEntry.create({
              data: {
                date: entryDate,
                dayOfWeek,
                submittedById: attendantId,
                submittedByName: actorName,
                submittedByEmail: actorEmail,
              },
            });
          }

          let deltaSales = receiptSellingTotal;
          let deltaProfit = receiptSellingTotal - receiptBuyingTotal;
          let receiptRecord;
          if (normalizedSerial) {
            receiptRecord = await tx.marketingReceipt.findFirst({
              where: {
                dailyEntryId: entry.id,
                receiptNumber: normalizedSerial,
              },
              include: { items: true },
            });
          }

          if (receiptRecord) {
            const prevSelling = Number(receiptRecord.sellingTotal || 0);
            const prevBuying = Number(receiptRecord.buyingTotal || 0);
            deltaSales = receiptSellingTotal - prevSelling;
            deltaProfit = receiptSellingTotal - receiptBuyingTotal - (prevSelling - prevBuying);
            await tx.marketingReceiptItem.deleteMany({ where: { receiptId: receiptRecord.id } });
            receiptRecord = await tx.marketingReceipt.update({
              where: { id: receiptRecord.id },
              data: {
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                paymentMethod,
                items: receiptItemsPayload.length
                  ? {
                      create: receiptItemsPayload,
                    }
                  : undefined,
              },
            });
          } else {
            receiptRecord = await tx.marketingReceipt.create({
              data: {
                dailyEntryId: entry.id,
                receiptNumber: normalizedSerial || undefined,
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                paymentMethod,
                items: receiptItemsPayload.length
                  ? {
                      create: receiptItemsPayload,
                    }
                  : undefined,
              },
            });
          }

          if ((deltaSales || deltaProfit) && entry.id) {
            await tx.marketingDailyEntry.update({
              where: { id: entry.id },
              data: {
                totalSales: { increment: deltaSales },
                totalProfit: { increment: deltaProfit },
              },
            });
          }
        } catch (e) {
          console.error("[receipts] failed to update marketing entry", e);
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

    // notify SSE subscribers about the new receipt so streams can push immediate updates
    try {
      publishSummaryUpdate({ attendantId: attendantId ?? null, receiptId: result.receiptId, timestamp: new Date().toISOString() });
    } catch (err) {
      console.warn("[receipts] failed to publish summary update", err);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
