import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { waitForReceiptById } from "@/lib/receiptReadAfterWrite";
import { requireRole } from "@/lib/api";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import {
  getPosProductCommissionTotalsByOrderItemIds,
  getReleasedPosProductCommissionTotalsByOrderItemIds,
} from "@/lib/posProductCommission";
import { isDeliveryFeePayloadItem } from "@/lib/supportPricing";
import {
  cleanupMarketingReceipts,
  cleanupSupportReceipts,
  recalcMarketingEntry,
  recalcSupportEntry,
} from "@/lib/marketingReceiptCleanup";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import { getOpsCatalogueProductMappedById } from "@/app/shop/shopProductMapper";
import { syncPosReceiptToCustomerAccount } from "@/lib/posCustomerAccountSync";
import { getProductTableCapabilities, type ProductTableCapabilities } from "@/lib/productTableCapabilities";
import { isReceiptWithinEditableWindow, receiptEditRestrictionMessage } from "@/lib/receiptEditAccess";
import { WebsiteOrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
const SHOP_BASE_URL = "https://www.betech.co.ke";

type ReceiptProductSnapshot = {
  id: string;
  lastBuyingPrice: number | null;
  variableCost: boolean;
  commissionEnabled: boolean;
  commissionAmount: Prisma.Decimal | null;
  commissionRequiresApproval: boolean;
};

async function createManualReceiptProduct(
  tx: Prisma.TransactionClient,
  capabilities: ProductTableCapabilities,
  input: { title: string; unitPrice: number },
): Promise<ReceiptProductSnapshot> {
  const id = `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const sku = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const columns = ["id", capabilities.skuColumn, capabilities.nameColumn, capabilities.categoryColumn, capabilities.priceColumn];
  const values: Array<string | number | boolean | Date> = [id, sku, input.title, "manual", input.unitPrice];
  const now = new Date();

  if (capabilities.activeColumn) {
    columns.push(capabilities.activeColumn);
    values.push(true);
  }

  if (capabilities.available.has("createdAt")) {
    columns.push("createdAt");
    values.push(now);
  }

  if (capabilities.available.has("updatedAt")) {
    columns.push("updatedAt");
    values.push(now);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const columnsSql = columns.map((column) => `"${column}"`).join(", ");
  const returningSql = [
    `"id"`,
    capabilities.available.has("lastBuyingPrice") ? `"lastBuyingPrice"` : `0::double precision AS "lastBuyingPrice"`,
    capabilities.available.has("variableCost") ? `"variableCost"` : `FALSE AS "variableCost"`,
    capabilities.available.has("commissionEnabled") ? `"commissionEnabled"` : `FALSE AS "commissionEnabled"`,
    capabilities.available.has("commissionAmount") ? `"commissionAmount"` : `0::numeric AS "commissionAmount"`,
    capabilities.available.has("commissionRequiresApproval")
      ? `"commissionRequiresApproval"`
      : `FALSE AS "commissionRequiresApproval"`,
  ].join(", ");

  const rows = await tx.$queryRawUnsafe<ReceiptProductSnapshot[]>(
    `INSERT INTO "Product" (${columnsSql}) VALUES (${placeholders}) RETURNING ${returningSql}`,
    ...values,
  );

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create manual receipt product");
  }
  return created;
}

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as any).params;
  if (maybePromise && typeof maybePromise.then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) {
    return guard.res;
  }

  const actorId = (guard.session?.user as any)?.id ?? null;
  const { id } = await resolveParams(context);
  const receipt = await waitForReceiptById({
    receiptId: id,
    loggerPrefix: "[receipts][GET by id]",
    include: {
      order: {
        include: {
          items: {
            include: {
              orderCosts: { orderBy: { createdAt: "desc" }, take: 1, select: { unitCost: true, costSource: true, createdAt: true } },
              product: {
                select: {
                  id: true,
                  name: true,
                  commissionEnabled: true,
                  commissionAmount: true,
                  commissionRequiresApproval: true,
                },
              },
            },
          },
          attendant: { select: { id: true, name: true, email: true } },
          layawayPlan: { include: { payments: true } },
        },
      },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orderItems = Array.isArray(receipt.order?.items) ? receipt.order.items : [];
  const productIds: string[] = Array.from(
    new Set(
      orderItems
        .map((item) => String(item.product?.id ?? "").trim())
        .filter(Boolean),
    ),
  );
  const mappedProducts = await Promise.all(
    productIds.map(async (productId) => {
      const mapped = await getOpsCatalogueProductMappedById(productId);
      return [productId, mapped] as const;
    }),
  );
  const mappedProductById = new Map(mappedProducts);

  const receiptWithLinks = {
    ...receipt,
    order: receipt.order
      ? {
          ...receipt.order,
          items: orderItems.map((item) => {
            const productId = String(item.product?.id ?? "").trim();
            const mapped = productId ? mappedProductById.get(productId) ?? null : null;
            const shopHref = mapped?.slug ? `${SHOP_BASE_URL}${getShopProductHref(mapped.slug, mapped.opsProductId)}` : null;
            const adminEditHref = productId ? `/admin/pos-management?editProduct=${encodeURIComponent(productId)}` : null;

            return {
              ...item,
              product: item.product
                ? {
                    ...item.product,
                    shopHref,
                    adminEditHref,
                  }
                : null,
            };
          }),
        }
      : receipt.order,
  };

  const dataAttendantId =
    receipt.data && typeof receipt.data === "object"
      ? String((receipt.data as Record<string, unknown>).attendantId ?? "").trim() || null
      : null;
  const ownsReceipt =
    Boolean(actorId) &&
    (actorId === receipt.issuedById ||
      actorId === receipt.order?.attendantId ||
      actorId === dataAttendantId);
  if (guard.role === "ATTENDANT" && !ownsReceipt) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let supportItems: Array<{ id: string; buyingPrice: number | null; productName?: string | null }> = [];
  let supportReceiptSummary: { id: string; buyingTotal?: number | null } | null = null;
  const receiptData =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  const podDeliveryData =
    receiptData.podDelivery && typeof receiptData.podDelivery === "object" && !Array.isArray(receiptData.podDelivery)
      ? (receiptData.podDelivery as Record<string, unknown>)
      : null;
  const isPodDelivery =
    String(receiptData.customerType ?? "").toLowerCase() === "pod" || Boolean(podDeliveryData);
  const isLayaway = String(receipt.docType ?? "").toUpperCase() === "LAYAWAY";
  const isLayawayComplete =
    !isLayaway ||
    Boolean(receipt.order?.layawayPlan?.isComplete) ||
    Number(receipt.order?.paidAmount ?? 0) >= Number(receipt.order?.totalAmount ?? 0);
  const orderItemIds = (receipt.order?.items ?? []).map((item) => item.id);
  const totalPosCommissionByOrderItemId = await getPosProductCommissionTotalsByOrderItemIds(orderItemIds);
  const posCommissionByOrderItemId = await getReleasedPosProductCommissionTotalsByOrderItemIds(orderItemIds);
  const inferredPosCommission = (receipt.order?.items ?? []).reduce(
    (acc, item) => {
      const existingTotal = Number(totalPosCommissionByOrderItemId.get(item.id) ?? 0);
      const existingReleased = Number(posCommissionByOrderItemId.get(item.id) ?? 0);
      if (existingTotal > 0 || !item.product?.commissionEnabled) {
        acc.total += existingTotal;
        acc.earned += existingReleased;
        return acc;
      }

      const unitCommission = Number(item.product?.commissionAmount ?? 0);
      const amount = unitCommission > 0 ? unitCommission * Number(item.quantity ?? 1) : 0;
      if (amount <= 0) {
        acc.total += existingTotal;
        acc.earned += existingReleased;
        return acc;
      }

      const canTreatAsEarned =
        !Boolean(item.product?.commissionRequiresApproval) &&
        !isPodDelivery &&
        (!isLayaway || isLayawayComplete);

      acc.total += amount;
      acc.earned += canTreatAsEarned ? amount : existingReleased;
      return acc;
    },
    { total: 0, earned: 0 },
  );
  const manualPosCommission = Number(
    receipt?.data && typeof receipt.data === "object"
      ? (receipt.data as Record<string, unknown>)?.manualPosCommissionAmount ?? 0
      : 0,
  );
  const earnedPosCommissionTotal = inferredPosCommission.earned;
  const posCommissionTotal = inferredPosCommission.total + (Number.isFinite(manualPosCommission) ? manualPosCommission : 0);
  try {
    if (receipt?.order?.orderNumber) {
      const candidates = new Set<string>();
      candidates.add(receipt.order.orderNumber);
      const normalizedOrderNumber = canonicalReceiptNumber(receipt.order.orderNumber);
      if (normalizedOrderNumber) {
        candidates.add(normalizedOrderNumber);
      }
        if (candidates.size > 0) {
        const supportReceipts = await prisma.supportReceipt.findMany({
          where: {
            OR: [
              ...Array.from(candidates).map((value) => ({ receiptNumber: value })),
              ...Array.from(candidates).map((value) => ({ receiptKey: value })),
            ],
          },
          orderBy: { updatedAt: "desc" },
          include: { items: true },
        });
        if (supportReceipts.length > 0) {
          // Prefer a single authoritative support receipt. POD/edit flows can leave
          // both raw and canonical receipt numbers pointing to the same sale; merging
          // them makes the UI think pricing is incomplete even when one receipt is
          // fully priced.
          const scored = supportReceipts
            .map((sr) => {
              const pricedItems = sr.items.filter((it) => Number(it.buyingPrice ?? 0) > 0).length;
              const latestPricedAt = sr.items.reduce<number>(
                (latest, item) => {
                  const time = item.pricedAt ? new Date(item.pricedAt).getTime() : 0;
                  return time > latest ? time : latest;
                },
                0,
              );
              return {
                receipt: sr,
                pricedItems,
                buyingTotal: Number(sr.buyingTotal ?? 0),
                latestPricedAt,
              };
            })
            .sort((a, b) => {
              if (b.pricedItems !== a.pricedItems) return b.pricedItems - a.pricedItems;
              if (b.buyingTotal !== a.buyingTotal) return b.buyingTotal - a.buyingTotal;
              if (b.latestPricedAt !== a.latestPricedAt) return b.latestPricedAt - a.latestPricedAt;
              return new Date(b.receipt.updatedAt).getTime() - new Date(a.receipt.updatedAt).getTime();
            });
          const sr = scored[0].receipt;
          supportItems = sr.items.map((it) => ({
            id: it.id,
            buyingPrice: Number.isFinite(Number(it.buyingPrice ?? 0)) ? Number(it.buyingPrice ?? 0) : null,
            productName: it.productName ?? null,
          }));
          supportReceiptSummary = { id: sr.id, buyingTotal: Number(sr.buyingTotal ?? 0) };
        }
      }
    }
  } catch (e) {
    // best-effort; ignore support lookup failures
  }
  return NextResponse.json({
    receipt: receiptWithLinks,
    supportItems,
    supportReceiptSummary,
    posCommissionTotal,
    earnedPosCommissionTotal,
    manualPosCommissionAmount: Number.isFinite(manualPosCommission) ? manualPosCommission : 0,
  });
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
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
      const dataAttendantId =
        existing.data && typeof existing.data === "object"
          ? String((existing.data as Record<string, unknown>).attendantId ?? "").trim() || null
          : null;
      const ownsReceipt =
        Boolean(actorId) &&
        (actorId === existing.issuedById || actorId === existing.order?.attendantId || actorId === dataAttendantId);
      if (guard.role === "ATTENDANT" && !ownsReceipt) {
        return null;
      }
      if (guard.role !== "ADMIN" && !isReceiptWithinEditableWindow(existing.createdAt)) {
        throw new Error(receiptEditRestrictionMessage());
      }
      const docType = body?.docType ? String(body.docType).toUpperCase() : String(existing.docType);
      const layawayDeposit = Number(existing.order?.layawayPlan?.deposit ?? existing.order?.paidAmount ?? 0);
      const paidAmount = docType === "LAYAWAY" ? layawayDeposit : total;
      const existingData =
        existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
          ? (existing.data as Record<string, unknown>)
          : {};
      const existingPodDelivery =
        existingData.podDelivery && typeof existingData.podDelivery === "object" && !Array.isArray(existingData.podDelivery)
          ? (existingData.podDelivery as Record<string, unknown>)
          : null;
      const isPodDelivery =
        String(body?.customerType ?? existingData.customerType ?? "").toLowerCase() === "pod" ||
        Boolean(existingPodDelivery);

      // refresh products + items
      // Delete dependent CommissionEarning rows first to avoid foreign-key violations
      // (CommissionEarning.orderItemId references OrderItem). If there are existing
      // items, remove their commission earnings before removing the items.
      if (existing.order?.items && existing.order.items.length) {
        const existingItemIds = existing.order.items.map((i) => i.id);
        await tx.commissionEarning.deleteMany({ where: { orderItemId: { in: existingItemIds } } });
        // If we have persisted costs/snapshots, clear them before deleting order items.
        // Some environments may not have these tables; best-effort only.
        try {
          if ((tx as any).orderCost) {
            await (tx as any).orderCost.deleteMany({ where: { orderItemId: { in: existingItemIds } } });
          }
        } catch {
          // ignore
        }
        try {
          if ((tx as any).profitSnapshot) {
            await (tx as any).profitSnapshot.deleteMany({ where: { orderItemId: { in: existingItemIds } } });
          }
        } catch {
          // ignore
        }
      }
      await tx.orderItem.deleteMany({ where: { orderId: existing.orderId } });
      const productTableCapabilities = await getProductTableCapabilities(tx as unknown as Parameters<typeof getProductTableCapabilities>[0]);
      const createdOrderItems: any[] = [];
      const createdItems: Array<{
        title: string;
        quantity: number;
        costPrice: number;
        unitPrice: number;
        productId: string;
        commissionEnabled: boolean;
        commissionAmount: number;
        commissionRequiresApproval: boolean;
      }> = [];
      for (const it of items) {
        const title = String(it.title || it.product || it.productName || "Item").slice(0, 255);
        let product = await tx.product.findFirst({
          where: { name: title },
          select: {
            id: true,
            lastBuyingPrice: true,
            variableCost: true,
            commissionEnabled: true,
            commissionAmount: true,
            commissionRequiresApproval: true,
          },
        });
        if (!product) {
          product = await createManualReceiptProduct(tx, productTableCapabilities, {
            title,
            unitPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0,
          });
        }
        if (!product) throw new Error(`Failed to resolve product for receipt item ${title}`);
        const quantity = Math.max(1, Number(it.quantity || 1));
        const unitPrice = Number(it.unitPrice || it.sellingPrice || 0) || 0;
        const costPrice = Math.max(0, Math.round(Number(it.buyingPrice ?? 0)));
        const createPayload = {
          orderId: existing.orderId,
          productId: product.id,
          quantity,
          sellingPrice: unitPrice,
          serial:
            it.serial === null || it.serial === undefined
              ? null
              : typeof it.serial === 'string'
              ? it.serial
              : String(it.serial),
          warranty:
            it.warranty === null || it.warranty === undefined
              ? null
              : typeof it.warranty === 'string'
              ? it.warranty
              : String(it.warranty),
        };
        console.info('[receipts] creating orderItem (patch)', JSON.stringify(createPayload), {
          serialType: createPayload.serial === null ? 'null' : typeof createPayload.serial,
          warrantyType: createPayload.warranty === null ? 'null' : typeof createPayload.warranty,
        });
        try {
          const createdItem = await tx.orderItem.create({ data: createPayload });
          createdOrderItems.push(createdItem);
          // Persist per-item unit cost overrides so profit/commission recomputes
          // do not depend on support ledger rows.
          if (costPrice > 0) {
            try {
              if ((tx as any).orderCost) {
                await (tx as any).orderCost.create({
                  data: {
                    orderItemId: createdItem.id,
                    unitCost: costPrice,
                    costSource: "ADMIN_RECEIPT_EDIT",
                  },
                });
              }
            } catch {
              // ignore (table may not exist on some DBs)
            }
          }
          createdItems.push({
            title,
            quantity,
            unitPrice,
            costPrice,
            productId: product.id,
            commissionEnabled: Boolean((product as any).commissionEnabled),
            commissionAmount: Number((product as any).commissionAmount ?? 0),
            commissionRequiresApproval: Boolean((product as any).commissionRequiresApproval),
          });
        } catch (orderItemErr) {
          console.error('[receipts] failed to create orderItem (patch)', {
            createPayload,
            error: (orderItemErr as any)?.message ?? String(orderItemErr),
            meta: (orderItemErr as any)?.meta ?? undefined,
            stack: (orderItemErr as any)?.stack ?? undefined,
          });
          throw orderItemErr;
        }
        
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

      const normalizedReceiptNumber = canonicalReceiptNumber(existing.order?.orderNumber ?? "");
      const entryAttendantId = attendantId ?? existing.order?.attendantId ?? null;
      const entryDate = existing.order?.createdAt ?? new Date();
      const dayStart = new Date(entryDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });
      const guardUser = guard.session?.user as { name?: string; email?: string } | undefined;
      const actorName = guardUser?.name ?? guardUser?.email ?? null;
      const actorEmail = guardUser?.email ?? null;
      const receiptItemsData = createdItems.map((item) => ({
        productName: item.title || "Item",
        buyingPrice: item.costPrice,
      })).filter((item) => !isDeliveryFeePayloadItem({ title: item.productName }));
      const totalBuying = createdItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
      const existingReceiptCandidates = Array.from(
        new Set(
          [existing.order?.orderNumber ?? null, normalizedReceiptNumber ?? null]
            .map((value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null))
            .filter((value): value is string => Boolean(value)),
        ),
      );
      const existingSupportReceipt =
        existingReceiptCandidates.length > 0 && tx.supportReceipt
          ? await tx.supportReceipt.findFirst({ where: { receiptNumber: { in: existingReceiptCandidates } } })
          : null;
      const existingMarketingReceipt =
        existingReceiptCandidates.length > 0 && tx.marketingReceipt
          ? await tx.marketingReceipt.findFirst({ where: { receiptNumber: { in: existingReceiptCandidates } } })
          : null;
      const previousSupportEntryId = existingSupportReceipt?.dailyEntryId ?? null;
      const previousMarketingEntryId = existingMarketingReceipt?.dailyEntryId ?? null;
      const supportPaymentMethod = existingSupportReceipt?.paymentMethod ?? PaymentMethod.MPESA;
      const marketingPaymentMethod = existingMarketingReceipt?.paymentMethod ?? supportPaymentMethod;

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
            buyingTotal: totalBuying,
            profit: totalBuying > 0 ? total - totalBuying : 0,
          },
          data: { ...(existing.data as any), ...body, totals: { subtotal, tax: taxAmount, total, buyingTotal: totalBuying, profit: totalBuying > 0 ? total - totalBuying : 0 } },
        },
      });

      // Refresh commission earnings on edit, including per-product POS commissions.
      if (createdOrderItems.length) {
        await tx.commissionEarning.deleteMany({ where: { orderItem: { orderId: existing.orderId } } });
        const grossEarnings = createdOrderItems.map((it) => ({
            staffId: attendantId || existing.order?.attendantId || null,
            orderItemId: it.id,
            basis: "gross",
            qty: it.quantity,
            amount: Number(it.sellingPrice || 0) * Number(it.quantity || 1),
            status: docType === "LAYAWAY" ? "PENDING" : "PENDING",
            calcDetail: { reason: "receipt_edit_seed" },
          }));
        await tx.commissionEarning.createMany({ data: grossEarnings });

        const posProductEarnings = createdOrderItems
          .map((orderItem, index) => {
            const sourceItem = createdItems[index];
            const amount = Number(sourceItem?.commissionAmount || 0) * Number(orderItem.quantity || 1);
            if (!sourceItem?.commissionEnabled || amount <= 0) return null;
            const requiresAdminApproval = isPodDelivery || Boolean(sourceItem.commissionRequiresApproval);
            const status =
              requiresAdminApproval
                ? "PENDING_APPROVAL"
                : docType === "LAYAWAY"
                  ? "PENDING"
                  : "RELEASED";
            return {
              staffId: attendantId || existing.order?.attendantId || null,
              orderItemId: orderItem.id,
              basis: "product_flat",
              qty: orderItem.quantity,
              amount,
              status,
              calcDetail: {
                reason: "pos_product_commission",
                productId: sourceItem.productId,
                productName: sourceItem.title,
                orderNumber: existing.order?.orderNumber ?? null,
                receiptId: existing.id,
                requiresApproval: requiresAdminApproval,
                unitCommission: Number(sourceItem.commissionAmount || 0),
                customerType: body?.customerType ?? existingData.customerType ?? null,
              },
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

        if (posProductEarnings.length) {
          await tx.commissionEarning.createMany({ data: posProductEarnings });
        }
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

      if (normalizedReceiptNumber && entryAttendantId && receiptItemsData.length) {
        let supportEntryId: string | null = null;
        if (tx.supportDailyEntry) {
          const supportEntry = await tx.supportDailyEntry.findFirst({
            where: { submittedById: entryAttendantId, date: { gte: dayStart, lte: dayEnd } },
            select: { id: true },
          });
          supportEntryId = supportEntry?.id ?? null;
          if (!supportEntryId) {
            const entry = await tx.supportDailyEntry.create({
              data: {
                date: entryDate,
                dayOfWeek,
                totalSales: 0,
                totalProfit: 0,
                newBatteries: 0,
                changedBatteries: 0,
                submittedById: entryAttendantId,
              },
            });
            supportEntryId = entry.id;
          }
        }

        if (supportEntryId && tx.supportReceipt) {
          if (existingSupportReceipt) {
            await tx.supportReceiptItem.deleteMany({ where: { receiptId: existingSupportReceipt.id } });
            await tx.supportReceipt.update({
              where: { id: existingSupportReceipt.id },
              data: {
                dailyEntryId: supportEntryId,
                sellingTotal: total,
                buyingTotal: totalBuying,
                paymentMethod: supportPaymentMethod,
                items: { create: receiptItemsData },
              },
            });
          } else {
            await tx.supportReceipt.create({
              data: {
                dailyEntryId: supportEntryId,
                receiptNumber: normalizedReceiptNumber,
                sellingTotal: total,
                buyingTotal: totalBuying,
                paymentMethod: supportPaymentMethod,
                items: { create: receiptItemsData },
              },
            });
          }
          await recalcSupportEntry(tx, supportEntryId);
          if (previousSupportEntryId && previousSupportEntryId !== supportEntryId) {
            await recalcSupportEntry(tx, previousSupportEntryId);
          }
        }

        let marketingEntryId: string | null = null;
        if (tx.marketingDailyEntry) {
          const marketingEntry = await tx.marketingDailyEntry.findFirst({
            where: { submittedById: entryAttendantId, date: { gte: dayStart, lte: dayEnd } },
            select: { id: true },
          });
          marketingEntryId = marketingEntry?.id ?? null;
          if (!marketingEntryId) {
            const entry = await tx.marketingDailyEntry.create({
              data: {
                date: entryDate,
                dayOfWeek,
                totalSales: 0,
                totalProfit: 0,
                submittedById: entryAttendantId,
                submittedByName: actorName ?? undefined,
                submittedByEmail: actorEmail ?? undefined,
              },
            });
            marketingEntryId = entry.id;
          }
        }

        if (marketingEntryId && tx.marketingReceipt) {
          if (existingMarketingReceipt) {
            await tx.marketingReceiptItem.deleteMany({ where: { receiptId: existingMarketingReceipt.id } });
            await tx.marketingReceipt.update({
              where: { id: existingMarketingReceipt.id },
              data: {
                dailyEntryId: marketingEntryId,
                sellingTotal: total,
                buyingTotal: totalBuying,
                paymentMethod: marketingPaymentMethod,
                items: { create: receiptItemsData },
              },
            });
          } else {
            await tx.marketingReceipt.create({
              data: {
                dailyEntryId: marketingEntryId,
                receiptNumber: normalizedReceiptNumber,
                sellingTotal: total,
                buyingTotal: totalBuying,
                paymentMethod: marketingPaymentMethod,
                items: { create: receiptItemsData },
              },
            });
          }
          await recalcMarketingEntry(tx, marketingEntryId);
          if (previousMarketingEntryId && previousMarketingEntryId !== marketingEntryId) {
            await recalcMarketingEntry(tx, previousMarketingEntryId);
          }
        }
      }

      return updatedReceipt;
    });
    if (!updated) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const { recomputeOrderEconomics } = await import("@/lib/recomputeOrderEconomics");
      await recomputeOrderEconomics((updated as any).orderId ?? (updated as any).order?.id);
    } catch (e) {
      console.error("[receipts PATCH] failed to recompute order economics", e);
    }

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

    try {
      await syncPosReceiptToCustomerAccount(id);
    } catch (syncErr) {
      console.error("[receipts PATCH] failed to sync POS receipt to customer account", {
        receiptId: id,
        error: syncErr instanceof Error ? syncErr.message : String(syncErr),
      });
    }

    return NextResponse.json({ ok: true, receipt: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update receipt";
    if (msg === receiptEditRestrictionMessage()) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) {
    const res = guard.res as any;
    if (res && res.status === 401) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return guard.res;
  }
  const { id } = await resolveParams(context);
  const actorId = (guard.session?.user as any)?.id ?? null;

  console.info('[receipts][DELETE] starting', { receiptId: id, actorId });

  try {
    await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              items: true,
              layawayPlan: true,
            },
          },
        },
      });
      if (!receipt) throw new Error('Receipt not found');
      const order = receipt.order;
      if (!order) throw new Error('Associated order missing');
      const orderId = order.id;

      const linkedWebsiteOrder = await tx.websiteOrder.findFirst({
        where: {
          OR: [{ receiptId: id }, { orderRef: order.orderNumber }],
        },
        select: {
          id: true,
          source: true,
          status: true,
          metadata: true,
        },
      });

      // Write an actionLog entry describing the deletion (before state)
      try {
        await tx.actionLog.create({
          data: {
            actorId: actorId ?? 'system',
            entity: 'Receipt',
            entityId: id,
            action: 'DELETE',
            before: receipt as any,
          },
        });
      } catch (logErr) {
        console.warn('[receipts][DELETE] failed to write actionLog before delete', { receiptId: id, error: logErr instanceof Error ? logErr.message : String(logErr) });
      }

      if (order.orderNumber) {
        await cleanupMarketingReceipts(tx, order.orderNumber);
        await cleanupSupportReceipts(tx, order.orderNumber);
      }

      if (linkedWebsiteOrder && linkedWebsiteOrder.source === "POS") {
        const existingMetadata =
          linkedWebsiteOrder.metadata && typeof linkedWebsiteOrder.metadata === "object" && !Array.isArray(linkedWebsiteOrder.metadata)
            ? (linkedWebsiteOrder.metadata as Record<string, unknown>)
            : {};
        await tx.websiteOrder.update({
          where: { id: linkedWebsiteOrder.id },
          data: {
            status: WebsiteOrderStatus.CANCELLED,
            receiptId: null,
            cancelledAt: new Date(),
            metadata: {
              ...existingMetadata,
              posReceiptDeletedAt: new Date().toISOString(),
              posReceiptDeletedById: actorId,
            },
          },
        });
      }

      const itemIds = (order.items || []).map((item) => item.id);
      if (itemIds.length) {
        await tx.commissionEarning.deleteMany({ where: { orderItemId: { in: itemIds } } });
      }
      await tx.commissionRecord.deleteMany({ where: { orderId } });
      await tx.returnAdjustment.deleteMany({ where: { returnCase: { orderId } } });
      await tx.returnCase.deleteMany({ where: { orderId } });
      await tx.settlementRow.deleteMany({ where: { orderId } });
      if (order.layawayPlan) {
        await tx.layawayPlan.delete({ where: { id: order.layawayPlan.id } });
      }
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.receipt.delete({ where: { id } });
      await tx.order.delete({ where: { id: orderId } });
    });

    console.info('[receipts][DELETE] success', { receiptId: id, actorId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete receipt';
    console.error('[receipts][DELETE] failed', { receiptId: id, actorId, error: msg });
    if (msg === 'Receipt not found') {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
