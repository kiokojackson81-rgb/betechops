import { NextRequest, NextResponse } from "next/server";
import { Prisma, WebsiteOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAdvanceWebsiteOrderStatus,
  ensureWebsiteOrderAssignments,
  ensureWebsiteOrdersSchema,
  isWebsiteOrderAssignedToUser,
  requireWebsiteOrdersStaffActor,
  serializeWebsiteOrder,
  websiteOrderAdminInclude,
  withWebsiteOrderAssignmentMetadata,
} from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<any> }) {
  const guard = await requireWebsiteOrdersStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  await ensureWebsiteOrdersSchema();
  await ensureWebsiteOrderAssignments();

  const { id } = (await context.params) as { id: string };
  const existing = await prisma.websiteOrder.findUnique({
    where: { id },
    select: { id: true, status: true, metadata: true },
  });
  if (!existing || !isWebsiteOrderAssignedToUser(existing.metadata, guard.userId)) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  if (existing.status === WebsiteOrderStatus.CANCELLED) {
    return NextResponse.json(
      { ok: false, error: "Cancelled website orders cannot be confirmed." },
      { status: 400 },
    );
  }

  const transition = canAdvanceWebsiteOrderStatus(existing.status, WebsiteOrderStatus.PROCESSING);
  if (!transition.ok) {
    return NextResponse.json({ ok: false, error: transition.error }, { status: 409 });
  }

  const metadata =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const order = await prisma.websiteOrder.update({
    where: { id },
    data: {
      status: WebsiteOrderStatus.PROCESSING,
      confirmedAt: new Date(),
      confirmedById: guard.userId,
      metadata: {
        ...(withWebsiteOrderAssignmentMetadata(metadata, {
          id: guard.userId,
          email: guard.email,
          name: guard.name,
        }) as Record<string, unknown>),
        processingAt: metadata.processingAt ?? new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
    include: websiteOrderAdminInclude,
  });

  return NextResponse.json({ ok: true, order: await serializeWebsiteOrder(order) });
}
