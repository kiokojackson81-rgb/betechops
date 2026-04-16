import React from "react";
import { prisma } from "@/lib/prisma";
import PrintControls from "./PrintControls";
import ReceiptPaymentMethodEditor from "./ReceiptPaymentMethodEditor";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import renderReceiptHtml from "@/lib/receipts/renderReceiptHtml";
import { auth } from "@/lib/auth";

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

  const snapshot = buildReceiptSnapshot(receipt);
  const html = await renderReceiptHtml(snapshot, { hideStamp: false });
  const initialPaymentMethod =
    String(snapshot?.paymentMethod ?? "").toUpperCase() === "CASH" ? "CASH" : "MPESA";
  const session = await auth();
  const actor = session?.user as { id?: string; role?: string } | undefined;
  const dataAttendantId =
    receipt.data && typeof receipt.data === "object"
      ? String((receipt.data as Record<string, unknown>).attendantId ?? "").trim() || null
      : null;
  const canEditPaymentMethod =
    actor?.role === "ADMIN" ||
    actor?.role === "SUPERVISOR" ||
    (Boolean(actor?.id) &&
      (actor?.id === receipt.issuedById ||
        actor?.id === receipt.order?.attendantId ||
        actor?.id === dataAttendantId));

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <PrintControls receiptId={id} />
      {canEditPaymentMethod ? (
        <ReceiptPaymentMethodEditor receiptId={id} initialPaymentMethod={initialPaymentMethod} />
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
