import React from "react";
import { prisma } from "@/lib/prisma";
import ReceiptDetailClient from "./ReceiptDetailClient";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import renderReceiptHtml from "@/lib/receipts/renderReceiptHtml";
import { auth } from "@/lib/auth";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: any }) {
  // In some hosting/runtime environments `params` can be a Promise (e.g. when
  // edge/request context is provided lazily). Defensively await if needed.
  let resolvedParams = params;
  if (resolvedParams && typeof resolvedParams.then === "function") {
    try {
      resolvedParams = await resolvedParams;
    } catch (e) {
      // If awaiting params fails, log and treat as missing.
      // eslint-disable-next-line no-console
      console.error("[receipts page] failed to resolve params", { err: e });
      resolvedParams = null;
    }
  }

  const id = resolvedParams?.id;
  if (!id) {
    // Log diagnostic info to help identify why requests reach this page without an id.
    try {
      // Log resolved params and a small environment hint; avoid leaking sensitive headers.
      // eslint-disable-next-line no-console
      console.error("[receipts page] missing params.id", {
        params: resolvedParams ?? params ?? null,
        nodeEnv: process.env.NODE_ENV,
      });
    } catch (e) {
      // swallow logging errors
    }
    // Defensive: avoid throwing a Prisma validation error if params are missing.
    return <div className="p-4">Invalid receipt identifier</div>;
  }

  let receipt: any = null;
  try {
    receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: { include: { product: { select: { id: true, name: true } } } },
            layawayPlan: { include: { payments: true } },
            attendant: { select: { name: true } },
          },
        },
        issuedBy: true,
      },
    });
  } catch (err) {
    // Catch and render a friendly message instead of allowing a server exception to surface.
    // Log the error server-side for diagnostics (kept minimal here).
    // eslint-disable-next-line no-console
    console.error("[receipts page] failed to load receipt", err);
    return <div className="p-4">Failed to load receipt</div>;
  }
  if (!receipt) return <div className="p-4">Receipt not found</div>;

  const session = await auth();
  const actor = session?.user as { id?: string; role?: string } | undefined;
  const dataAttendantId =
    receipt.data && typeof receipt.data === "object"
      ? String((receipt.data as Record<string, unknown>).attendantId ?? "").trim() || null
      : null;
  const canViewReceipt =
    actor?.role === "ADMIN" ||
    actor?.role === "SUPERVISOR" ||
    (Boolean(actor?.id) &&
      (actor?.id === receipt.issuedById ||
        actor?.id === receipt.order?.attendantId ||
        actor?.id === dataAttendantId));
  if (!canViewReceipt) return <div className="p-4">Receipt not found</div>;
  const snapshot = buildReceiptSnapshot(receipt);
  const html = await renderReceiptHtml(snapshot, { hideStamp: false });
  const initialPaymentMethod =
    String(snapshot?.paymentMethod ?? "").toUpperCase() === "CASH" ? "CASH" : "MPESA";
  const canEditPaymentMethod = canViewReceipt;
  const supportCostMap = new Map<string, number>();
  const normalizedReceiptNumber = canonicalReceiptNumber(receipt.order?.orderNumber ?? "");
  if (normalizedReceiptNumber) {
    const supportReceipts = await prisma.supportReceipt.findMany({
      where: { receiptNumber: normalizedReceiptNumber },
      include: { items: true },
    });
    for (const supportReceipt of supportReceipts) {
      for (const item of supportReceipt.items) {
        const key = String(item.productName ?? "").trim().toLowerCase();
        if (key && !supportCostMap.has(key)) {
          supportCostMap.set(key, Math.max(0, Number(item.buyingPrice ?? 0)));
        }
      }
    }
  }

  const dataItems = Array.isArray(receipt?.data?.items) ? receipt.data.items : [];
  const orderItems = Array.isArray(receipt?.order?.items) ? receipt.order.items : [];
  const sourceItems = dataItems.length ? dataItems : orderItems;
  const initialDraft = {
    docType: String(receipt?.docType ?? "RECEIPT").toUpperCase(),
    attendantId: receipt.order?.attendantId ?? dataAttendantId ?? null,
    customerName: receipt.order?.customerName || receipt.data?.customerName || "",
    customerPhone: receipt.order?.customerPhone || receipt.data?.customerPhone || "",
    taxRate: Number(receipt?.taxRate ?? 0),
    showTax: Boolean(receipt?.showTax),
    discount: Number(receipt?.discount ?? 0),
    showDiscount: Boolean(receipt?.showDiscount),
    paymentDetailsShown: Boolean(receipt?.paymentDetailsShown),
    notes: receipt?.notes ?? null,
    warrantyText: receipt?.warrantyText ?? null,
    items:
      sourceItems.length > 0
        ? sourceItems.map((item: any, index: number) => {
            const title = String(item.title || item.productName || item.name || item.product?.name || "Item");
            const key = title.trim().toLowerCase();
            return {
              id: String(item.id ?? `${id}-${index}`),
              title,
              quantity: Math.max(1, Number(item.quantity || 1)),
              unitPrice: Math.max(0, Number(item.unitPrice ?? item.sellingPrice ?? item.price ?? 0)),
              buyingPrice: Math.max(
                0,
                Number(item.buyingPrice ?? (key ? supportCostMap.get(key) : 0) ?? 0),
              ),
              serial: item.serial ?? null,
              warranty: item.warranty ?? null,
            };
          })
        : [
            {
              id: `${id}-item-0`,
              title: "",
              quantity: 1,
              unitPrice: 0,
              buyingPrice: 0,
              serial: null,
              warranty: null,
            },
          ],
  };

  return (
    <ReceiptDetailClient
      receiptId={id}
      html={html}
      canEdit={canEditPaymentMethod}
      initialPaymentMethod={initialPaymentMethod}
      initialDraft={initialDraft}
    />
  );
}
