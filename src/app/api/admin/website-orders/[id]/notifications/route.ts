import { CustomerOrderNotificationEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyWebsiteOrderCustomer } from "@/lib/customerOrderNotifications";
import { prisma } from "@/lib/prisma";
import { requireWebsiteOrdersAdmin } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

const resendSchema = z.object({ event: z.nativeEnum(CustomerOrderNotificationEventType) });

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const notifications = await prisma.customerOrderNotificationLog.findMany({
    where: { websiteOrderId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, eventType: true, channel: true, recipientAddress: true, status: true, attemptCount: true, errorMessage: true, createdAt: true, sentAt: true, failedAt: true },
  });
  return NextResponse.json({ ok: true, notifications });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const payload = resendSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ ok: false, error: "Choose a valid notification event." }, { status: 400 });
  const { id } = await context.params;
  const exists = await prisma.websiteOrder.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  const result = await notifyWebsiteOrderCustomer({ websiteOrderId: id, event: payload.data.event, force: true });
  return NextResponse.json({ ok: true, result });
}
