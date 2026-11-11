import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAccessibleCommissioningSession } from "@/lib/commissioning";
import { initiateStkPushForResource, MPESA_EXPRESS_MAX_AMOUNT } from "@/lib/mpesa";
import { prisma } from "@/lib/prisma";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  phoneNumber: z.string().trim().min(8).max(30),
  amount: z.coerce.number().int().positive(),
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid Kenyan M-Pesa number and payment amount." }, { status: 400 });

  const receipt = await prisma.receipt.findUnique({
    where: { id: session.receiptId },
    include: { order: { select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true, metadata: true, status: true } } },
  });
  if (!receipt?.order) return NextResponse.json({ error: "Project payment record was not found." }, { status: 404 });
  if (receipt.order.status === "CANCELED") return NextResponse.json({ error: "A cancelled project cannot receive payment." }, { status: 409 });
  const flow = readReceiptProjectFlow(asRecord(receipt.data).projectFlow);
  if (!flow) return NextResponse.json({ error: "This receipt is not an installation project." }, { status: 400 });

  const outstanding = Math.max(0, Number(receipt.order.totalAmount) - Number(receipt.order.paidAmount));
  if (outstanding < 1) return NextResponse.json({ error: "This project has no outstanding balance." }, { status: 409 });
  const maximum = Math.min(outstanding, MPESA_EXPRESS_MAX_AMOUNT);
  if (parsed.data.amount > maximum) return NextResponse.json({ error: `M-Pesa Express is limited to KSh ${MPESA_EXPRESS_MAX_AMOUNT.toLocaleString("en-KE")} per prompt. Start with KSh ${maximum.toLocaleString("en-KE")} and pay the remaining balance in the next prompt.` }, { status: 400 });

  const metadata = asRecord(receipt.order.metadata);
  const awaitingMetadata = { ...metadata, customerType: "project", projectFlow: flow, installationPaymentState: "AWAITING_PAYMENT", installationPaymentKind: "BALANCE", installationPaymentDue: outstanding, installationPaymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), installationPaymentFailureReason: null };
  await prisma.order.update({ where: { id: receipt.order.id }, data: { metadata: awaitingMetadata } });
  try {
    const result = await initiateStkPushForResource({ resourceType: "INSTALLATION_PROJECT", reference: receipt.order.orderNumber, phoneNumber: parsed.data.phoneNumber, installmentAmount: parsed.data.amount });
    return NextResponse.json({ ok: true, ...result, outstanding, maximum }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the M-Pesa Express prompt.";
    await prisma.order.update({ where: { id: receipt.order.id }, data: { metadata: { ...awaitingMetadata, installationPaymentState: "PAYMENT_FAILED", installationPaymentFailureReason: message } } }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
