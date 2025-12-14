import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import renderReceiptTemplate from "@/app/templates/receiptTemplate";

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
  try {
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

    if (!receipt) return new NextResponse("Not found", { status: 404 });

    const order = receipt.order || {};
    const items = (order.items || []).map((it: any) => ({
      title: it.product?.name || it.title || it.productName || "",
      quantity: it.quantity ?? 1,
      unitPrice: it.sellingPrice ?? it.unitPrice ?? 0,
      serial: it.serial ?? "",
      warranty: it.warranty ?? "",
    }));

    const snapshot: any = {
      order,
      items,
      totals: receipt.totals ?? order.totals ?? {},
      notes: receipt.notes ?? (receipt.data && receipt.data.notes) ?? "",
      generatedAt: receipt.generatedAt ? receipt.generatedAt.toISOString() : new Date().toISOString(),
      customerName: order.customerName || "",
      attendantName: receipt.issuedBy?.name || order?.attendant?.name || "",
      paymentMethod: (receipt.data && receipt.data.paymentMethod) || receipt.paymentMethod || "",
      deliveryAddress: (order.metadata && order.metadata.deliveryAddress) || (receipt.data && receipt.data.deliveryAddress) || "",
    };

    const html = renderReceiptTemplate(snapshot, { hideStamp: false });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
