import React from "react";
import MarkdownRendererClient, { RichFormattingToggle } from "@/components/MarkdownRendererClient";
import { prisma } from "@/lib/prisma";
import PrintControls from "./PrintControls";
import ReceiptPrintView from "../_components/ReceiptPrintView";

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
      include: { order: { include: { items: true, layawayPlan: { include: { payments: true } }, attendant: { select: { name: true } } } }, issuedBy: true },
    });
  } catch (err) {
    // Catch and render a friendly message instead of allowing a server exception to surface.
    // Log the error server-side for diagnostics (kept minimal here).
    // eslint-disable-next-line no-console
    console.error("[receipts page] failed to load receipt", err);
    return <div className="p-4">Failed to load receipt</div>;
  }
  if (!receipt) return <div className="p-4">Receipt not found</div>;

  const data = (receipt.data as any) || {};
  const totals = (receipt.totals as any) || {};
  const balance = totals.balance ?? receipt.order?.layawayPlan?.balance ?? 0;

  // Build a lightweight `data` object suitable for the client-side `ReceiptPrintView`.
  const viewData = {
    serial: receipt.order?.orderNumber || receipt.serial || "",
    date: receipt.generatedAt,
    customerName: receipt.order?.customerName || data.customerName,
    customerPhone: receipt.order?.customerPhone || data.customerPhone,
    deliveryAddress: data.deliveryAddress || receipt.order?.deliveryAddress || "",
    attendantName: receipt.order?.attendant?.name || receipt.issuedBy?.name || data.issuedByName,
    items: (receipt.order?.items || []).map((it: any) => ({
      title: it.title || it.productName,
      quantity: it.quantity ?? it.qty ?? 1,
      unitPrice: it.sellingPrice ?? it.unitPrice ?? it.price ?? 0,
      serial: it.serial,
      warranty: it.warranty,
    })),
    totals: {
      subtotal: totals.subtotal ?? receipt.subtotal ?? 0,
      tax: totals.tax ?? receipt.tax ?? 0,
      total: totals.total ?? receipt.total ?? 0,
      balance: balance,
    },
    notes: receipt.notes || data.notes || "",
    paymentMethod: receipt.paymentMethod || data.paymentMethod || receipt.order?.paymentMethod || "",
    paymentDetailsShown: Boolean(receipt.paymentDetailsShown || data.paymentDetailsShown),
    showTax: Boolean(data.showTax || receipt.showTax),
    discount: receipt.discount ?? data.discount ?? 0,
  };

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <PrintControls receiptId={id} />
      {/* Render the styled printable receipt view for consistency with printed output */}
      {/* ReceiptPrintView is a client component that handles markdown rendering and print layout */}
      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
      {/* @ts-ignore-next-line */}
      <ReceiptPrintView data={viewData} mode="preview" />
    </div>
  );
}
