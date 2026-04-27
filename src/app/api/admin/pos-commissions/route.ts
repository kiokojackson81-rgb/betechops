import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const APPROVAL_PENDING_STATUSES = ["PENDING_APPROVAL", "PENDING"];

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "pending").trim().toUpperCase();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));

  const where =
    status === "ALL"
      ? {}
      : status === "RELEASED"
        ? { status: { in: ["RELEASED", "APPROVED"] } }
        : status === "REJECTED"
          ? { status: { in: ["REJECTED", "REVERSED"] } }
          : { status: { in: APPROVAL_PENDING_STATUSES } };

  const items = await prisma.commissionEarning.findMany({
    where,
    include: {
      staff: { select: { id: true, name: true, email: true } },
      orderItem: {
        include: {
          product: true,
          order: { select: { id: true, orderNumber: true, customerName: true, attendantId: true, createdAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const filtered = items.filter((item) => {
    const detail = item.calcDetail as Record<string, unknown> | null;
    return item.basis === "product_flat" || detail?.reason === "pos_product_commission";
  });

  return noStoreJson({ items: filtered });
}
