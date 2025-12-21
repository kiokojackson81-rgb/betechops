import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/workers/receiptSender";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";

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
          items: { include: { product: { select: { id: true, name: true } } } },
          attendant: { select: { id: true, name: true } },
          layawayPlan: { include: { payments: true } },
        },
      },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const snapshot = buildReceiptSnapshot(receipt);
  const pdfBuffer = await generateReceiptPdf(snapshot, { hideStamp: false });
  if (!pdfBuffer) {
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  const fileName = `${receipt.order?.orderNumber ?? receipt.id}.pdf`;
  // Convert Node Buffer to a Uint8Array which is accepted by NextResponse
  const uint8 = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);

  // Cast to BodyInit to satisfy NextResponse TypeScript typing on build
  return new NextResponse(uint8 as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
