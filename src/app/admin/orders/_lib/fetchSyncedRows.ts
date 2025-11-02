import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { OrdersQuery, OrdersRow } from "./types";
import { cleanShopName } from "@/lib/jumia/orderHelpers";

function pickComparableDate(order: {
  updatedAtJumia: Date | null;
  createdAtJumia: Date | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return order.updatedAtJumia ?? order.createdAtJumia ?? order.updatedAt ?? order.createdAt;
}

export async function fetchSyncedRows(params: OrdersQuery): Promise<OrdersRow[]> {
  const where: Prisma.JumiaOrderWhereInput = {};
  if (params.status && params.status !== "ALL") where.status = params.status;
  if (params.shopId && params.shopId !== "ALL") where.shopId = params.shopId;
  if (params.country) where.countryCode = params.country.trim().toUpperCase();

  const from = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00Z`) : null;
  const to = params.dateTo ? new Date(`${params.dateTo}T23:59:59Z`) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from && !Number.isNaN(from.getTime())) range.gte = from;
    if (to && !Number.isNaN(to.getTime())) range.lte = to;
    where.OR = [
      { updatedAtJumia: range },
      { AND: [{ updatedAtJumia: null }, { createdAtJumia: range }] },
      { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: range }] },
    ];
  }

  const take = Math.max(1, Math.min(parseInt(params.size ?? "100", 10) || 100, 1000));
  const orders = await prisma.jumiaOrder.findMany({
    where,
    include: {
      shop: {
        select: {
          name: true,
          account: { select: { label: true } },
        },
      },
    },
    orderBy: [
      { updatedAtJumia: "desc" },
      { createdAtJumia: "desc" },
      { updatedAt: "desc" },
    ],
    take,
  });

  const filtered = orders.filter((order) => {
    const comparable = pickComparableDate(order);
    if (params.dateFrom) {
      const fromDate = new Date(`${params.dateFrom}T00:00:00Z`);
      if (!Number.isNaN(fromDate.getTime()) && comparable < fromDate) return false;
    }
    if (params.dateTo) {
      const toDate = new Date(`${params.dateTo}T23:59:59Z`);
      if (!Number.isNaN(toDate.getTime()) && comparable > toDate) return false;
    }
    if (params.q) {
      const term = params.q.trim().toLowerCase();
      if (term) {
        const maybeNumber = Number.parseInt(term, 10);
        const numberMatches = Number.isFinite(maybeNumber) && order.number !== null && order.number === maybeNumber;
        const textHaystack = [
          order.id,
          order.status ?? "",
          order.pendingSince ?? "",
          order.countryCode ?? "",
          order.shop?.name ?? "",
          order.shop?.account?.label ?? "",
        ]
          .concat(order.number !== null ? String(order.number) : [])
          .map((value) => String(value).toLowerCase());
        const textMatches = textHaystack.some((value) => value.includes(term));
        if (!numberMatches && !textMatches) return false;
      }
    }
    return true;
  });

  return filtered.map((order) => {
    const created = order.createdAtJumia ?? order.updatedAtJumia ?? order.createdAt;
    const updated = order.updatedAtJumia ?? order.updatedAt;
    // Show a single, clean shop name (avoid duplicating account label + shop name)
    const shopLabel = cleanShopName(order.shop?.name ?? undefined, order.shop?.account?.label ?? undefined) ?? order.shopId;

    return {
      id: order.id,
      number: order.number !== null && order.number !== undefined ? String(order.number) : undefined,
      status: order.status ?? undefined,
      pendingSince: order.pendingSince ?? undefined,
      createdAt: created?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: updated?.toISOString?.(),
      totalItems: order.totalItems ?? undefined,
      packedItems: order.packedItems ?? undefined,
      shopName: shopLabel ?? undefined,
      shopId: order.shopId ?? undefined,
      shopIds: order.shopId ? [order.shopId] : undefined,
      isPrepayment: order.isPrepayment ?? undefined,
    } satisfies OrdersRow;
  });
}
