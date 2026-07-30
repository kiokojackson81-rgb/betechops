import { NextRequest, NextResponse } from "next/server";
import { WebsiteOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ensureWebsiteOrderAssignments,
  ensureWebsiteOrdersSchema,
  isWebsiteOrderAssignedToUser,
  requireWebsiteOrdersStaffActor,
  serializeWebsiteOrders,
  WEBSITE_ORDER_ACTIVE_STATUSES,
  websiteOrderAdminInclude,
} from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireWebsiteOrdersStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  await ensureWebsiteOrdersSchema();
  await ensureWebsiteOrderAssignments();

  const searchParams = request.nextUrl.searchParams;
  const statusParam = (searchParams.get("status") || "ALL").toUpperCase();
  const q = (searchParams.get("q") || "").trim();
  const statuses =
    statusParam === "ALL"
      ? WEBSITE_ORDER_ACTIVE_STATUSES
      : WEBSITE_ORDER_ACTIVE_STATUSES.filter((status) => status === statusParam);

  const orders = await prisma.websiteOrder.findMany({
    where: {
      source: "WEBSITE",
      status: { in: statuses.length ? statuses : [WebsiteOrderStatus.PENDING] },
      ...(q
        ? {
            OR: [
              { orderRef: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
              { customerPhone: { contains: q, mode: "insensitive" } },
              { customerLocation: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: websiteOrderAdminInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  const assignedOrders = orders.filter((order) =>
    isWebsiteOrderAssignedToUser(order.metadata, guard.userId, guard.email),
  );
  const serializedOrders = await serializeWebsiteOrders(assignedOrders);

  return NextResponse.json({
    ok: true,
    orders: serializedOrders,
  });
}
