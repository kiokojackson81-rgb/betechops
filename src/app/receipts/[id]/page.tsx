import React from "react";
import { prisma } from "@/lib/prisma";
import ReceiptDetailClient from "./ReceiptDetailClient";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import renderReceiptHtml from "@/lib/receipts/renderReceiptHtml";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: any }) {
  let resolvedParams = params;
  if (resolvedParams && typeof resolvedParams.then === "function") {
    try {
      resolvedParams = await resolvedParams;
    } catch (e) {
      console.error("[receipts page] failed to resolve params", { err: e });
      resolvedParams = null;
    }
  }

  const id = resolvedParams?.id;
  if (!id) {
    try {
      console.error("[receipts page] missing params.id", {
        params: resolvedParams ?? params ?? null,
        nodeEnv: process.env.NODE_ENV,
      });
    } catch {}
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
    <ReceiptDetailClient
      receiptId={id}
      html={html}
      canEditPaymentMethod={canEditPaymentMethod}
      initialPaymentMethod={initialPaymentMethod}
    />
  );
}
