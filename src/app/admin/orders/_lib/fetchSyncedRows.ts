import { prisma } from "@/lib/prisma";
import type { OrdersQuery, OrdersRow } from "./types";
import { cleanShopName } from "@/lib/jumia/orderHelpers";
import { normalizeStatus } from "@/lib/jumia/orderStatus";

function pickComparableDate(order: {
  updatedAtJumia: Date | null;
  createdAtJumia: Date | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return order.updatedAtJumia ?? order.createdAtJumia ?? order.updatedAt ?? order.createdAt;
}

export async function fetchSyncedRows(params: OrdersQuery): Promise<OrdersRow[]> {
  // Use a flexible where type to avoid tight coupling to generated Prisma types in CI/builds
  const where: any = {};
  const status = normalizeStatus(params.status);
  if (status && status !== "ALL") where.status = status;
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

  const normalizedStatus = (params.status ?? "").toUpperCase();
  const defaultSize = normalizedStatus === "PENDING" ? 500 : 100;
  const parsedSize = Number.parseInt(params.size ?? "", 10);
  const take = Math.max(
    1,
    Math.min(Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : defaultSize, 1000),
  );
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

  // Ensure we have a best-effort shop name for every order.
  // Some rows may lack the joined `shop` relation (or its name) depending on
  // how/when the order was inserted. In that case, fall back to looking up
  // the `JumiaShop` directory so the UI can consistently display a friendly
  // shop name instead of the raw ID.
  try {
    const missingShopIds = Array.from(
      new Set(
        orders
          .map((o: any) => o.shopId)
          .filter((s: any) => s && (!orders.find((x: any) => x.shopId === s)?.shop || !orders.find((x: any) => x.shopId === s)?.shop?.name)),
      ),
    );
    if (missingShopIds.length) {
      const resolved = await prisma.jumiaShop.findMany({
        where: { id: { in: missingShopIds } },
        select: { id: true, name: true, account: { select: { label: true } } },
      }).catch(() => [] as any[]);
      const byId = new Map<string, { name?: string; accountLabel?: string | null }>();
      for (const r of resolved) byId.set(r.id, { name: r.name, accountLabel: r.account?.label ?? null });
      // Attach resolution results onto the in-memory order objects so downstream
      // mapping can prefer these when the joined relation is absent.
      for (const o of orders) {
        if ((!o.shop || !o.shop.name) && o.shopId && byId.has(o.shopId)) {
          const val = byId.get(o.shopId)!;
          // Attach a synthetic `shop` shape matching the include above
          o.shop = { name: val.name, account: { label: val.accountLabel } };
        }
      }
    }
  } catch {
    // best-effort only; any failures here shouldn't block returning orders
  }

  const filtered = orders.filter((order: any) => {
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

  return filtered.map((order: any) => {
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
      totalAmountLocal: order.totalAmountLocalValue !== null && order.totalAmountLocalValue !== undefined
        ? { currency: order.totalAmountLocalCurrency ?? '', value: Number(order.totalAmountLocalValue) }
        : undefined,
      shopName: shopLabel ?? undefined,
      shopId: order.shopId ?? undefined,
      shopIds: order.shopId ? [order.shopId] : undefined,
      isPrepayment: order.isPrepayment ?? undefined,
    } satisfies OrdersRow;
  });
}
