import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { initiateStkPushForResource } from "@/lib/mpesa";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phoneNumber: z.string().trim().min(8).max(30).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid customer M-Pesa number." }, { status: 400 });

  const { id } = await context.params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { order: { select: { id: true, orderNumber: true, customerPhone: true, totalAmount: true, paidAmount: true, metadata: true, status: true } } },
  });
  if (!receipt?.order) return NextResponse.json({ error: "Project payment record was not found." }, { status: 404 });
  if (receipt.order.status === "CANCELED") return NextResponse.json({ error: "A cancelled project cannot be prompted for payment." }, { status: 409 });
  const receiptData = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? receipt.data as Record<string, unknown> : {};
  const flow = readReceiptProjectFlow(receiptData.projectFlow);
  if (!flow) return NextResponse.json({ error: "This receipt is not a project receipt." }, { status: 400 });
  const outstanding = Math.max(0, Number(receipt.order.totalAmount) - Number(receipt.order.paidAmount));
  if (outstanding < 1) return NextResponse.json({ error: "This project has no outstanding balance." }, { status: 409 });

  const metadata = receipt.order.metadata && typeof receipt.order.metadata === "object" && !Array.isArray(receipt.order.metadata) ? receipt.order.metadata as Record<string, unknown> : {};
  await prisma.order.update({
    where: { id: receipt.order.id },
    data: { metadata: { ...metadata, customerType: "project", projectFlow: flow, installationPaymentState: "AWAITING_PAYMENT", installationPaymentKind: "BALANCE", installationPaymentDue: outstanding, installationPaymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), installationPaymentFailureReason: null } },
  });
  try {
    const result = await initiateStkPushForResource({ resourceType: "INSTALLATION_PROJECT", reference: receipt.order.orderNumber, phoneNumber: parsed.data.phoneNumber || receipt.order.customerPhone || undefined });
    return NextResponse.json({ ok: true, ...result, outstanding }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the M-Pesa Express prompt.";
    await prisma.order.update({ where: { id: receipt.order.id }, data: { metadata: { ...metadata, installationPaymentState: "PAYMENT_FAILED", installationPaymentKind: "BALANCE", installationPaymentDue: outstanding, installationPaymentFailureReason: message } } }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
