import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, Prisma, type SupportReceipt } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseNumber, parseIntLike } from "@/lib/parseNumber";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";
import { requireAttendant, auth } from "@/lib/auth";
import { canonicalReceiptNumber, parsePaymentMethod, buildReceiptKey } from "@/lib/receipts/utils";
import { findReceiptOwner, buildDuplicateMessage } from "@/lib/receiptGuard";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";
import { generateRandomId } from "@/lib/id";
import { normalizeReceiptSerial } from "@/lib/receipts/serial";
import { sendReceiptChannels } from "@/workers/receiptSender";
import { getSiteUrl, notifyInternalReceipt } from "@/lib/receiptInternalNotifications";
import { randomUUID } from "crypto";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";

const normalizePaymentMethod = (value: unknown): "MPESA" | "CASH" | null => {
  if (typeof value !== "string") return null;
  const candidate = value.toUpperCase().trim();
  if (candidate === "CASH") return "CASH";
  if (candidate === "MPESA") return "MPESA";
  return null;
};

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
  const docTypeParam = url.searchParams.get("docType") || undefined;
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const issuerOnly = url.searchParams.get("issuerOnly") === "true";
  const paymentMethodParam = normalizePaymentMethod(url.searchParams.get("paymentMethod"));
  const includeItems = url.searchParams.get("includeItems") === "true";
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const size = Math.min(200, Math.max(1, Number(url.searchParams.get("size") || "50")));
  const identity = await resolveTargetUserId(req);
  const meta = identity;
  const attendantId = identity.resolvedUserId;
  if (!attendantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const startDefault = new Date(today);
  startDefault.setHours(0, 0, 0, 0);
  const endDefault = new Date(today);
  endDefault.setHours(23, 59, 59, 999);
  const startDate = start ? new Date(start) : startDefault;
  const endDate = end ? new Date(end) : endDefault;

  const normalizedDocType = docTypeParam ? docTypeParam.toUpperCase() : undefined;
  const isMarketingDocType = normalizedDocType === "MARKETING";
  const isSupportDocType = normalizedDocType === "SUPPORT";
  const includePosReceipts = !normalizedDocType || (!isMarketingDocType && !isSupportDocType);
  const includeMarketingReceipts = !normalizedDocType || isMarketingDocType;
  const includeSupportReceipts = !normalizedDocType || isSupportDocType;

  const and: Prisma.ReceiptWhereInput[] = [];
  and.push({ generatedAt: { gte: startDate, lte: endDate } });

  if (normalizedDocType && !isMarketingDocType && !isSupportDocType) {
    and.push({ docType: normalizedDocType as any });
  }

  if (paymentMethodParam) {
    and.push({ data: { path: ["paymentMethod"], equals: paymentMethodParam } });
  }

  const searchOr: Prisma.ReceiptWhereInput[] = [];
  if (q) {
    searchOr.push(
      { order: { customerName: { contains: q, mode: "insensitive" } } },
      { order: { customerPhone: { contains: q, mode: "insensitive" } } },
      { order: { customerEmail: { contains: q, mode: "insensitive" } } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { order: { attendant: { name: { contains: q, mode: "insensitive" } } } },
      { issuedBy: { name: { contains: q, mode: "insensitive" } } },
    );
  }

  if (phoneParam) {
    const pRaw = String(phoneParam).replace(/[^+0-9]/g, "");
    let local = pRaw;
    if (pRaw.startsWith("+254")) local = "0" + pRaw.slice(4);
    else if (pRaw.startsWith("254")) local = "0" + pRaw.slice(3);
    else if (/^[7][0-9]{8}$/.test(pRaw)) local = "0" + pRaw;

    searchOr.push({ order: { customerPhone: { contains: pRaw, mode: "insensitive" } } });
    if (local) searchOr.push({ order: { customerPhone: { contains: local, mode: "insensitive" } } });
  }

  if (searchOr.length) and.push({ OR: searchOr });

  // Scope decision (strict)
  const role = identity.actorRole;
  const isImpersonating = Boolean(identity.impersonateId && identity.resolvedUserId && identity.actorId && identity.resolvedUserId !== identity.actorId);
  const requestedScope = url.searchParams.get("scope"); // "mine" | "global"
  const wantsGlobal = requestedScope === "global";
  const canGlobal = role === "ADMIN" || role === "SUPERVISOR";
  const specialGlobalViewer = identity.actorEmail === "jeniffer@betech.co.ke";
  const allowGlobalScope = specialGlobalViewer || (wantsGlobal && canGlobal);
  // Rules: impersonating forces mine; otherwise admins/supervisors (or the special viewer) may request global explicitly (or automatically)
  const scope = isImpersonating ? "mine" : allowGlobalScope ? "global" : "mine";
  const metaWithScope = { ...meta, scope };

  if (scope === "mine") {
    const ownerOr: Prisma.ReceiptWhereInput[] = [];
    ownerOr.push(
      { issuedById: attendantId },
      { order: { attendantId } },
      { data: { path: ["attendantId"], equals: attendantId } },
    );
    // If issuerOnly requested, restrict to issuedById only
    if (issuerOnly) {
      and.push({ issuedById: attendantId });
    } else {
      and.push({ OR: ownerOr });
    }
  }

  // Optional filter: customerType=pod to show POD receipts only, with optional status filter
  const customerType = url.searchParams.get('customerType') || undefined;
  const podStatus = url.searchParams.get('status') || undefined; // expected values: 'pending'|'delivered'|'delivery_failed'
    if (customerType === 'pod') {
    if (podStatus) {
      and.push({ data: { path: ['podDelivery', 'status'], equals: podStatus } });
    } else {
      // any receipt that has podDelivery metadata
      and.push({ data: { path: ['podDelivery'], not: Prisma.JsonNull } });
    }
  } else {
    // Do not exclude POD-pending receipts from the list API — the admin
    // UI wants to display POD receipts in the listing. Aggregation and
    // counting logic should exclude pending POD receipts (handled client-
    // side in the admin UI and in dedicated summary endpoints).
    // If the caller explicitly requests POD receipts via `customerType=pod`,
    // the earlier branch above will apply the appropriate filter.
  }

  const where: Prisma.ReceiptWhereInput = { AND: and };

  const posReceipts = includePosReceipts
    ? await prisma.receipt.findMany({
        where,
        include: {
          order: includeItems
            ? { include: { items: true, attendant: { select: { id: true, name: true } } } }
            : {
                select: {
                  orderNumber: true,
                  customerName: true,
                  attendant: { select: { id: true, name: true } },
                  status: true,
                  paymentStatus: true,
                  totalAmount: true,
                },
              },
          issuedBy: { select: { id: true, name: true } },
        },
        orderBy: { generatedAt: "desc" },
      })
    : [];

  const mapPosRow = (r: any) => {
    const podDeliveryData = (r.data as any)?.podDelivery;
    return {
      id: r.id,
      source: "pos" as const,
      orderRef: r.order?.orderNumber,
      docType: r.docType,
      createdAt: r.generatedAt,
      customerName: r.order?.customerName,
      customerPhone: (r.order as any)?.customerPhone ?? null,
      total: (r.totals as any)?.total ?? (r.order as any)?.totalAmount ?? null,
      attendantName: (r.order as any)?.attendant?.name ?? r.issuedBy?.name ?? null,
      status: r.order?.status ?? r.order?.paymentStatus ?? null,
      items: includeItems ? ((r.order as any)?.items ?? []) : undefined,
      paymentMethod: normalizePaymentMethod((r.data as any)?.paymentMethod) ?? null,
      paymentStatus: (r.order as any)?.paymentStatus ?? null,
      detailUrl: `/receipts/${r.id}`,
      isPodDelivery: Boolean(podDeliveryData?.status),
      podDeliveryStatus: podDeliveryData?.status ?? null,
      podDeliveryNote: podDeliveryData?.note ?? null,
    };
  };

  const mapMarketingRow = (receipt: any) => ({
    id: `marketing-${receipt.id}`,
    source: "marketing" as const,
    orderRef: receipt.receiptNumber || undefined,
    docType: "MARKETING",
    createdAt: receipt.createdAt,
    customerName: null,
    customerPhone: null,
    total: Number(receipt.sellingTotal ?? 0),
    attendantName:
      receipt.dailyEntry?.submittedBy?.name ?? receipt.dailyEntry?.submittedByName ?? null,
    status: "COMPLETED",
    items: includeItems
      ? (receipt.items || []).map((item: any) => ({
          id: item.id,
          productName: item.productName,
          buyingPrice: Number(item.buyingPrice ?? 0),
        }))
      : undefined,
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    paymentStatus: "PAID",
    detailUrl: null,
  });

  const mapSupportRow = (receipt: any) => ({
    id: `support-${receipt.id}`,
    source: "support" as const,
    orderRef: receipt.receiptNumber || undefined,
    docType: "SUPPORT",
    createdAt: receipt.createdAt,
    customerName: null,
    customerPhone: null,
    total: Number(receipt.sellingTotal ?? 0),
    attendantName:
      receipt.dailyEntry?.submittedBy?.name ?? receipt.dailyEntry?.submittedByName ?? null,
    status: "COMPLETED",
    items: includeItems
      ? (receipt.items || []).map((item: any) => ({
          id: item.id,
          productName: item.productName,
          buyingPrice: Number(item.buyingPrice ?? 0),
        }))
      : undefined,
    paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
    paymentStatus: "PAID",
    detailUrl: null,
  });

  const marketingFilter: any = {
    dailyEntry: {
      date: { gte: startDate, lte: endDate },
    },
  };
  if (scope === "mine" && attendantId) marketingFilter.dailyEntry.submittedById = attendantId;
  if (paymentMethodParam) marketingFilter.paymentMethod = paymentMethodParam;
  if (q) {
    marketingFilter.OR = [
      { receiptNumber: { contains: q, mode: "insensitive" } },
      { dailyEntry: { submittedByName: { contains: q, mode: "insensitive" } } },
      { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const supportFilter: any = {
    dailyEntry: {
      date: { gte: startDate, lte: endDate },
    },
  };
  if (scope === "mine" && attendantId) supportFilter.dailyEntry.submittedById = attendantId;
  if (paymentMethodParam) supportFilter.paymentMethod = paymentMethodParam;
  if (q) {
    supportFilter.OR = [
      { receiptNumber: { contains: q, mode: "insensitive" } },
      {
        dailyEntry: {
          submittedBy: { name: { contains: q, mode: "insensitive" } },
        },
      },
      { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const marketingReceipts = includeMarketingReceipts
    ? await prisma.marketingReceipt.findMany({
        where: marketingFilter,
        include: {
          items: true,
          dailyEntry: {
            include: {
              submittedBy: { select: { id: true, name: true } },
            },
          },
        },
      })
    : [];

  const supportReceipts = includeSupportReceipts
    ? await prisma.supportReceipt.findMany({
        where: supportFilter,
        include: {
          items: true,
          dailyEntry: {
            include: {
              submittedBy: { select: { id: true, name: true } },
            },
          },
        },
      })
    : [];

  const combined = [
    ...posReceipts.map(mapPosRow),
    ...marketingReceipts.map(mapMarketingRow),
    ...supportReceipts.map(mapSupportRow),
  ];

  const sourcePriority: Record<"pos" | "marketing" | "support", number> = {
    pos: 3,
    marketing: 2,
    support: 1,
  };

  const uniqueReceipts = new Map<string, typeof combined[number]>();
  for (const row of combined) {
    const normalized = row.orderRef ? canonicalReceiptNumber(row.orderRef) : "";
    const key = normalized || row.id;
    const existing = uniqueReceipts.get(key);
    const priority = sourcePriority[row.source ?? "pos"];
    const existingPriority = existing ? sourcePriority[existing.source ?? "pos"] : 0;
    if (!existing || priority > existingPriority) {
      uniqueReceipts.set(key, row);
    }
  }

  const deduped = Array.from(uniqueReceipts.values());
  deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalCount = deduped.length;
  const paged = deduped.slice((page - 1) * size, page * size);
  const totalPages = Math.max(1, Math.ceil(totalCount / size));
  const data = { receipts: paged, paging: { page, size, totalCount, totalPages } };
  return NextResponse.json(composeIdentityResponse(metaWithScope, data));
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
  const isPodDelivery = Boolean(payload?.podDelivery);
  const requestId = randomUUID();

  // use shared parse helpers from src/lib/parseNumber

  const serial = normalizeReceiptSerial(payload?.serial);
  const docType = (String(payload?.docType || "RECEIPT")).toUpperCase();
  const resolvedUserId = guard?.user?.id ?? null;
  // Attendant (who gets credited) should come from the payload (attendantId/servedBy)
  // and only fall back to the resolved/logged-in user when not provided.
  const attendantId = payload?.attendantId ?? payload?.servedBy ?? resolvedUserId ?? null;
  // issuedById MUST be the logged-in user (who clicked Save). Do not trust payload. This prevents
  // admins or impersonation sessions from altering the recorded creator/issuer of a receipt.
  const issuedById = resolvedUserId;

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
    // allow linking when caller opts-in via ?link=1 or payload.link = true
    let allowLink = Boolean(payload?.link);
    try {
      const url = req && req.url ? new URL(req.url) : null as any;
      if (url) {
        allowLink = url.searchParams.get("link") === "1" || url.searchParams.get("link") === "true" || allowLink;
      }
    } catch (e) {
      // malformed or missing URL in test mocks - fall back to payload.link
      allowLink = Boolean(payload?.link);
    }

    // Early duplicate guard: check across POS, marketing, support
    const existing = await findReceiptOwner(String(serial));
    if (existing && !allowLink) {
      const msg = buildDuplicateMessage(serial, existing);
      return NextResponse.json({ ok: false, code: "DUPLICATE_RECEIPT", message: msg, owner: existing }, { status: 409 });
    }

    // If linking is allowed and an existing owner is found, we'll link to it inside the transaction.
    const ownerToLink = existing ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const entryDate = payload?.date ? new Date(payload.date) : new Date();
      const entryDateIso = entryDate.toISOString();
      const metadataFromPayload =
        payload?.metadata ?? (payload?.deliveryAddress ? { deliveryAddress: payload.deliveryAddress } : undefined);
      const podMetadata = isPodDelivery
        ? {
            ...(metadataFromPayload ?? {}),
            podDelivery: {
              status: 'pending',
              type: 'pay_on_delivery',
              note: payload?.podDelivery?.note ?? null,
              createdAt: entryDateIso,
              createdById: issuedById ?? null,
            },
          }
        : metadataFromPayload;
      const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });

      const orderStatus = docType === "LAYAWAY" ? "PENDING" : isPodDelivery ? "PENDING" : "COMPLETED";
      const orderPaymentStatus = docType === "LAYAWAY" ? "PARTIAL" : isPodDelivery ? "UNPAID" : "PAID";
      const paidAmountValue = docType === "LAYAWAY" ? deposit : isPodDelivery ? 0 : Number(total) || 0;
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
        const itemSerial = typeof it.serial === "string" ? it.serial.trim() || null : null;
        const itemWarranty = typeof it.warranty === "string" ? it.warranty.trim() || null : null;
        createdItems.push({
          product,
          quantity,
          unitPrice,
          serial: itemSerial,
          warranty: itemWarranty,
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
          // persist deliveryAddress inside `metadata` JSON to avoid schema mismatch
          metadata: podMetadata,
          shopId,
          status: orderStatus,
          paymentStatus: orderPaymentStatus,
          totalAmount: Number(total) || 0,
          paidAmount: paidAmountValue,
          // metadata already set above (may include deliveryAddress)
        },
        update: {
          customerName: payload?.customerName ?? undefined,
          customerPhone: payload?.customerPhone ?? undefined,
          customerEmail: payload?.customerEmail ?? undefined,
          attendantId: attendantId ?? undefined,
          // merge/update metadata to include deliveryAddress when present
          metadata: podMetadata,
          totalAmount: Number(total) || undefined,
          paidAmount: paidAmountValue,
          status: orderStatus,
          paymentStatus: orderPaymentStatus,
          // metadata already set above (may include deliveryAddress)
        },
      });

      // clear existing order items for update case (simple approach)
      await tx.orderItem.deleteMany({ where: { orderId: orderUpsert.id } });

      const createdOrderItems: any[] = [];
      for (const it of createdItems) {
        // Ensure numeric and integer types are strictly coerced for Prisma
        const qty = Math.max(1, Math.trunc(Number(it.quantity ?? 1)));
        const rawUnitPriceInput = it.unitPrice ?? '';
        if (typeof rawUnitPriceInput === 'string') {
          console.info('[receipts] raw item.unitPrice before parsing', {
            orderNumber: serial,
            itemTitle: it.title,
            rawUnitPrice: rawUnitPriceInput,
          });
        }
        const normalizedUnitPriceInput =
          typeof rawUnitPriceInput === 'string'
            ? rawUnitPriceInput.replace(/[^0-9.\-]/g, '').trim()
            : rawUnitPriceInput;
        if (
          typeof rawUnitPriceInput === 'string' &&
          normalizedUnitPriceInput !== rawUnitPriceInput
        ) {
          console.warn('[receipts] cleaned unitPrice string', {
            raw: rawUnitPriceInput,
            cleaned: normalizedUnitPriceInput,
          });
        }
        const sellingPrice = Number(parseNumber(normalizedUnitPriceInput));
        const orderItemPayload = {
          orderId: orderUpsert.id,
          productId: String(it.product?.id ?? it.product),
          quantity: qty,
          sellingPrice: sellingPrice,
          serial: it.serial ?? null,
          warranty: it.warranty ?? null,
        } as const;

        if (!Number.isFinite(orderItemPayload.sellingPrice)) {
          throw new Error(`Invalid selling price for item ${it.title} -> ${String(it.unitPrice)}`);
        }

        // Extra logging to help diagnose DB-level "trailing characters" errors
        console.debug("[receipts] persist order item payload types", {
          orderIdType: typeof orderItemPayload.orderId,
          productIdType: typeof orderItemPayload.productId,
          quantityType: typeof orderItemPayload.quantity,
          sellingPriceType: typeof orderItemPayload.sellingPrice,
          serialType: typeof orderItemPayload.serial,
          warrantyType: typeof orderItemPayload.warranty,
        });

        let safePayload: any = undefined;
        try {
          safePayload = {
            orderId: String(orderItemPayload.orderId),
            productId: String(orderItemPayload.productId),
            quantity: Number(orderItemPayload.quantity) || 0,
            sellingPrice: Number(orderItemPayload.sellingPrice) || 0,
            serial:
              orderItemPayload.serial === null || orderItemPayload.serial === undefined
                ? undefined
                : typeof orderItemPayload.serial === 'string'
                ? orderItemPayload.serial
                : String(orderItemPayload.serial),
            warranty:
              orderItemPayload.warranty === null || orderItemPayload.warranty === undefined
                ? undefined
                : typeof orderItemPayload.warranty === 'string'
                ? orderItemPayload.warranty
                : String(orderItemPayload.warranty),
          };
          console.info('[receipts] creating orderItem', JSON.stringify(safePayload), {
            serialType: safePayload.serial === undefined ? 'undefined' : safePayload.serial === null ? 'null' : typeof safePayload.serial,
            warrantyType: safePayload.warranty === undefined ? 'undefined' : safePayload.warranty === null ? 'null' : typeof safePayload.warranty,
          });
          // Diagnostic: log UTF-8 byte arrays to detect hidden/trailing characters
          try {
            console.info('[receipts] creating orderItem bytes', {
              serialBytes: safePayload.serial ? Array.from(Buffer.from(String(safePayload.serial), 'utf8')) : [],
              warrantyBytes: safePayload.warranty ? Array.from(Buffer.from(String(safePayload.warranty), 'utf8')) : [],
            });
          } catch (e) {
            // ignore diagnostics failing
          }
          const item = await tx.orderItem.create({ data: safePayload });
          createdOrderItems.push(item);
        } catch (orderItemError) {
          const orderItemErrorMsg = (orderItemError as any)?.message ?? String(orderItemError);
          console.error('[receipts] failed to persist order item', {
            payload: orderItemPayload,
            safePayload,
            serialType: typeof orderItemPayload.serial,
            warrantyType: typeof orderItemPayload.warranty,
            error: orderItemErrorMsg,
            errorMeta: (orderItemError as any)?.meta ?? undefined,
            errorStack: (orderItemError as any)?.stack ?? undefined,
          });
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
      const receiptSerialCanonical =
        canonicalReceiptNumber(serial) ??
        canonicalReceiptNumber(orderUpsert.orderNumber) ??
        `ID:${orderUpsert.id}`;

      const receiptData = {
        orderId: orderUpsert.id,
        receiptNumber: receiptSerialCanonical,
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
          ...(isPodDelivery
            ? {
                podDelivery: {
                  status: 'pending',
                  type: 'pay_on_delivery',
                  note: payload?.podDelivery?.note ?? null,
                  createdAt: entryDateIso,
                  createdById: issuedById ?? null,
                },
              }
            : {}),
        },
      } as any;

      // upsert receipt by orderId, or link to existing owner when requested
      let receipt;
      if (ownerToLink && ownerToLink.type === "pos" && ownerToLink.id) {
        // Link: update the existing POS receipt record with merged data and any linking metadata
        try {
          const existingPos = await tx.receipt.findUnique({ where: { id: ownerToLink.id } });
          if (existingPos) {
            const leftData = existingPos.data && typeof existingPos.data === "object" && !Array.isArray(existingPos.data)
              ? (existingPos.data as Record<string, any>)
              : {};
            const rightData = receiptData.data && typeof receiptData.data === "object" && !Array.isArray(receiptData.data)
              ? (receiptData.data as Record<string, any>)
              : {};
            const mergedData = { ...leftData, ...rightData };
            // attach linking hints if provided
            if (payload?.marketingEntryId) mergedData.marketingEntryId = payload.marketingEntryId;
            if (payload?.marketingReceiptId) mergedData.marketingReceiptId = payload.marketingReceiptId;
            if (payload?.supportEntryId) mergedData.supportEntryId = payload.supportEntryId;
            if (payload?.supportReceiptId) mergedData.supportReceiptId = payload.supportReceiptId;
            receipt = await tx.receipt.update({ where: { id: ownerToLink.id }, data: { ...receiptData, data: mergedData } });
          } else {
            receipt = await tx.receipt.create({ data: receiptData });
          }
        } catch (e) {
          // fallback to normal upsert behavior
          const existingReceipt = await tx.receipt.findUnique({ where: { orderId: orderUpsert.id } });
          if (existingReceipt) {
            receipt = await tx.receipt.update({ where: { id: existingReceipt.id }, data: receiptData });
          } else {
            receipt = await tx.receipt.create({ data: receiptData });
          }
        }
      } else {
        // normal upsert by orderId
        const existingReceipt = await tx.receipt.findUnique({ where: { orderId: orderUpsert.id } });
        if (existingReceipt) {
          receipt = await tx.receipt.update({ where: { id: existingReceipt.id }, data: receiptData });
        } else {
          receipt = await tx.receipt.create({ data: receiptData });
        }
      }

      // Seed CommissionEarning rows (pending) for this order's items; recompute jobs can overwrite
      if (createdOrderItems.length && attendantId && tx.commissionEarning && typeof tx.commissionEarning.createMany === 'function') {
        try {
          if (!isPodDelivery) {
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
          } else {
            // For POD receipts, seed earnings as PENDING so no immediate releases occur
            await tx.commissionEarning.createMany({
              data: createdOrderItems.map((it) => ({
                staffId: attendantId,
                orderItemId: it.id,
                basis: "gross",
                qty: it.quantity,
                amount: 0,
                status: "PENDING",
                calcDetail: { reason: "receipt_seed_pod", total },
              })),
            });
          }
        } catch (e) {
          // ignore if tx mock doesn't implement commissionEarning
        }
      }

      // Record support daily entry + receipt so support commission ledger can include this sale
      if (attendantId && !isPodDelivery) {
        const startOfDay = new Date(entryDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(entryDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Support daily entry + receipts (idempotent upsert with deltas)
        if (tx.supportDailyEntry && tx.supportReceipt) {
          try {
            const existingEntry = await tx.supportDailyEntry.findFirst({
              where: { submittedById: attendantId, date: { gte: startOfDay, lte: endOfDay } },
              select: { id: true, totalSales: true, totalProfit: true },
            });

            const supportReceiptItems = createdItems.map((it) => ({
              productName: String(it.title || "Item").trim(),
              buyingPrice: Math.max(0, Math.round(Number(it.costPrice || 0))),
            }));
            const supportReceiptBuyingTotal = supportReceiptItems.reduce((sum, item) => sum + (item.buyingPrice || 0), 0);
            const supportSellingTotal = Math.round(Number(total) || 0);

            const normalizedSerial = canonicalReceiptNumber(serial);
            const receiptKey = buildReceiptKey(entryDate, normalizedSerial);
            const paymentMethod = parsePaymentMethod(payload?.paymentMethod, PaymentMethod);

            const entryId = existingEntry?.id ?? (
              await tx.supportDailyEntry.create({
                data: {
                  date: entryDate,
                  dayOfWeek,
                  totalSales: 0,
                  totalProfit: 0,
                  newBatteries: 0,
                  changedBatteries: 0,
                  submittedById: attendantId,
                },
                select: { id: true },
              })
            ).id;

            let deltaSales = supportSellingTotal;
            let deltaProfit = supportSellingTotal - supportReceiptBuyingTotal;

            if (receiptKey) {
              const prev = await tx.supportReceipt.findUnique({
                where: { receiptKey },
                select: { sellingTotal: true, buyingTotal: true },
              });

              const prevSelling = Number(prev?.sellingTotal ?? 0);
              const prevBuying = Number(prev?.buyingTotal ?? 0);

              deltaSales = supportSellingTotal - prevSelling;
              deltaProfit = (supportSellingTotal - supportReceiptBuyingTotal) - (prevSelling - prevBuying);

              await tx.supportReceipt.upsert({
                where: { receiptKey },
                create: {
                  dailyEntryId: entryId,
                  receiptNumber: normalizedSerial || undefined,
                  receiptKey,
                  paymentMethod,
                  sellingTotal: supportSellingTotal,
                  buyingTotal: supportReceiptBuyingTotal,
                  items: supportReceiptItems.length ? { create: supportReceiptItems } : undefined,
                },
                update: {
                  paymentMethod,
                  sellingTotal: supportSellingTotal,
                  buyingTotal: supportReceiptBuyingTotal,
                  items: {
                    deleteMany: {},
                    ...(supportReceiptItems.length ? { create: supportReceiptItems } : {}),
                  },
                },
              });
            } else {
              await tx.supportReceipt.create({
                data: {
                  dailyEntryId: entryId,
                  receiptNumber: null,
                  receiptKey: null,
                  paymentMethod,
                  sellingTotal: supportSellingTotal,
                  buyingTotal: supportReceiptBuyingTotal,
                  items: supportReceiptItems.length ? { create: supportReceiptItems } : undefined,
                },
              });
            }

            if (deltaSales || deltaProfit) {
              await tx.supportDailyEntry.update({
                where: { id: entryId },
                data: { totalSales: { increment: deltaSales }, totalProfit: { increment: deltaProfit } },
              });
            }
          } catch (e) {
            // ignore support ledger errors in test mocks
          }
        }
      }

      if (attendantId && !isPodDelivery && tx.marketingDailyEntry && tx.marketingReceipt) {
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
          const receiptBuyingTotal = receiptItemsPayload.reduce((s, i) => s + i.buyingPrice, 0);
          const receiptKey = buildReceiptKey(entryDate, normalizedSerial);
          const paymentMethod = parsePaymentMethod(payload?.paymentMethod, PaymentMethod);

          let entry = await tx.marketingDailyEntry.findFirst({
            where: { submittedById: attendantId, date: { gte: marketingStart, lte: marketingEnd } },
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
                totalSales: 0,
                totalProfit: 0,
              },
            });
          }

          let deltaSales = receiptSellingTotal;
          let deltaProfit = receiptSellingTotal - receiptBuyingTotal;

          if (receiptKey) {
            const prev = await tx.marketingReceipt.findUnique({
              where: { receiptKey },
              select: { sellingTotal: true, buyingTotal: true },
            });

            const prevSelling = Number(prev?.sellingTotal ?? 0);
            const prevBuying = Number(prev?.buyingTotal ?? 0);

            deltaSales = receiptSellingTotal - prevSelling;
            deltaProfit = (receiptSellingTotal - receiptBuyingTotal) - (prevSelling - prevBuying);

            await tx.marketingReceipt.upsert({
              where: { receiptKey },
              create: {
                dailyEntryId: entry.id,
                receiptNumber: normalizedSerial || undefined,
                receiptKey,
                paymentMethod,
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                items: receiptItemsPayload.length ? { create: receiptItemsPayload } : undefined,
              },
              update: {
                paymentMethod,
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                items: {
                  deleteMany: {},
                  ...(receiptItemsPayload.length ? { create: receiptItemsPayload } : {}),
                },
              },
            });
          } else {
            await tx.marketingReceipt.create({
              data: {
                dailyEntryId: entry.id,
                receiptNumber: null,
                receiptKey: null,
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                paymentMethod,
                items: receiptItemsPayload.length ? { create: receiptItemsPayload } : undefined,
              },
            });
          }

          if ((deltaSales || deltaProfit) && entry.id) {
            await tx.marketingDailyEntry.update({
              where: { id: entry.id },
              data: { totalSales: { increment: deltaSales }, totalProfit: { increment: deltaProfit } },
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
          if (!isPodDelivery) {
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
          } else {
            // For POD receipts, create per-item earnings but leave as PENDING (no immediate releases)
            const perItemEarnings = createdOrderItems.map((it) => {
              const gross = Number(it.sellingPrice || 0) * Number(it.quantity || 1);
              return { staffId: attendantId, orderItemId: it.id, basis: "gross", qty: it.quantity, amount: gross, status: "PENDING", calcDetail: { reason: "receipt_seed_pod", total } };
            });
            await tx.commissionEarning.createMany({ data: perItemEarnings });
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

      // Optionally release immediately if threshold met (skip for POD receipts)
      if (!isPodDelivery && Number(total) >= IMMEDIATE_THRESHOLD && attendantId) {
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
            await tx.commissionLedger.create({
              data: {
                userId: attendantId,
                periodStart: period.startDate,
                periodEnd: period.endDate,
                grossCommission: Number(salesCommission),
                penalties: 0,
                netCommission: Number(salesCommission),
                commissionTotal: Number(salesCommission),
                detail: { reason: "Immediate release on threshold" },
              },
            });
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

    let sendResult: any = null;
    if (!isPodDelivery) {
      console.info(`[receiptSender][${requestId}] START send pipeline`);
      try {
        sendResult = await sendReceiptChannels(result.receiptId, [], { requestId });
        console.info(`[receiptSender][${requestId}] SEND:ok`, {
          channelStatus: sendResult.channelStatus,
        });
      } catch (sendErr) {
        console.error(`[receiptSender][${requestId}] SEND:error`, sendErr);
        sendResult = {
          ok: false,
          sent: [],
          errors: [{ channel: 'send', error: String(sendErr) }],
          channelStatus: {},
        };
      }

      const pdfForInternal = sendResult.pdfUrlCustomer ?? sendResult.pdfUrlFull;
      if (pdfForInternal) {
        try {
          await notifyInternalReceipt(result.receiptId, docType, requestId, pdfForInternal);
        } catch (internalErr) {
          console.error("[receipts] failed to notify internal ops", internalErr);
        }
      } else {
        console.info(`[receiptSender][${requestId}] INTERNAL:skipped missing_pdf`);
      }
    } else {
      // For POD receipts, still trigger an immediate WhatsApp via Chatrace at
      // creation time (whatsapp-only). This sends using the POD dispatch tag and
      // skips default tags so downstream routing can treat it as a POD event.
      console.info(`[receiptSender][${requestId}] START send pipeline (pod_delivery)`);
      try {
        sendResult = await sendReceiptChannels(result.receiptId, ['whatsapp'], {
          requestId,
          chatraceTag: 'betech_dispatch_pay_on_delivery',
          skipDefaultChatraceTags: true,
          markPodSent: true,
        });
        console.info(`[receiptSender][${requestId}] SEND:ok`, { channelStatus: sendResult.channelStatus });
      } catch (sendErr) {
        console.error(`[receiptSender][${requestId}] SEND:error (pod)`, sendErr);
        sendResult = {
          ok: false,
          sent: [],
          errors: [{ channel: 'send', error: String(sendErr) }],
          channelStatus: {},
        };
      }

      const pdfForInternal = sendResult.pdfUrlCustomer ?? sendResult.pdfUrlFull;
      if (pdfForInternal) {
        try {
          await notifyInternalReceipt(result.receiptId, docType, requestId, pdfForInternal);
        } catch (internalErr) {
          console.error("[receipts] failed to notify internal ops (pod)", internalErr);
        }
      } else {
        console.info(`[receiptSender][${requestId}] INTERNAL:skipped missing_pdf (pod)`);
      }
    }

    return NextResponse.json({ ok: true, ...result, send: sendResult });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    try {
      console.error('[receipts.POST] unexpected error', err);
    } catch (e) {
      // ignore logging failures
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

