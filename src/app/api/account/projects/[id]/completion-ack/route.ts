import { NextRequest, NextResponse } from "next/server";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { getCustomerAccountOrderDetail } from "@/lib/shopCustomerOrders";
import { prisma } from "@/lib/prisma";
import { appendCommissioningAudit } from "@/lib/commissioning";

export const dynamic = "force-dynamic";
type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: NextRequest, context: ParamsContext) {
  const { id } = await context.params;
  const { userId, identity } = await getCustomerAccountContext();
  const order = await getCustomerAccountOrderDetail({ routeId: `receipt-${id}`, ...identity });
  if (!order) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (!body?.installationCompleted || !body?.termsAccepted) return NextResponse.json({ error: "Confirm completion and accept the terms first." }, { status: 400 });
  const session = await prisma.commissioningSession.findUnique({ where: { receiptId: id } });
  if (!session || session.status !== "ISSUED") return NextResponse.json({ error: "Certificate is not ready yet." }, { status: 409 });
  const now = new Date();
  await prisma.commissioningSession.update({ where: { id: session.id }, data: { customerAcknowledgedAt: now, customerTermsAcceptedAt: now, audit: appendCommissioningAudit(session.audit, { at: now.toISOString(), action: "CUSTOMER_ACCEPTED_COMPLETION_AND_TERMS", actorId: userId }) } });
  return NextResponse.json({ ok: true, acknowledgedAt: now });
}
