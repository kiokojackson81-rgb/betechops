import OrdersFilters from './_components/OrdersFilters';
import OrdersTable from './_components/OrdersTable';
import { absUrl, withParams } from '@/lib/abs-url';
import { prisma } from '@/lib/prisma';
import AutoRefresh from '@/app/_components/AutoRefresh';
import OrdersSSE from './_components/OrdersSSE';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const DEFAULT_STATUS = 'PENDING';

type Search = {
  status?: string;
  country?: string;
  shopId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  nextToken?: string;
  size?: string;
};

export type Row = {
  id: string;
  number?: string;
  status?: string;
  pendingSince?: string;
  createdAt: string;
  updatedAt?: string;
  totalItems?: number;
  packedItems?: number;
  totalAmountLocal?: { currency: string; value: number };
  shopName?: string;
  shopIds?: string[];
  isPrepayment?: boolean;
};

async function fetchRemoteOrders(params: Search) {
  const base = await absUrl('/api/orders');
  const query = new URLSearchParams();

  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.country) query.set('country', params.country);
  if (params.shopId) query.set('shopId', params.shopId);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.q) query.set('q', params.q);
  if (params.nextToken) query.set('nextToken', params.nextToken);
  if (params.size) query.set('size', params.size);

  const url = withParams(base, Object.fromEntries(query.entries()));
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json() as Promise<{
    orders?: Array<Record<string, unknown>>;
    nextToken?: string | null;
    isLastPage?: boolean;
  }>;
}

function pickComparableDate(order: {
  updatedAtJumia: Date | null;
  createdAtJumia: Date | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return order.updatedAtJumia ?? order.createdAtJumia ?? order.updatedAt ?? order.createdAt;
}

async function fetchSyncedRows(params: Search): Promise<Row[]> {
  const where: Prisma.JumiaOrderWhereInput = {};
  if (params.status && params.status !== 'ALL') where.status = params.status;
  if (params.shopId && params.shopId !== 'ALL') where.shopId = params.shopId;
  if (params.country) where.countryCode = params.country.trim().toUpperCase();

  const take = Math.max(1, Math.min(parseInt(params.size ?? '100', 10) || 100, 1000));
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
      { updatedAtJumia: 'desc' },
      { createdAtJumia: 'desc' },
      { updatedAt: 'desc' },
    ],
    take,
  });

  const filtered = orders.filter((order) => {
    const comparable = pickComparableDate(order);
    if (params.dateFrom) {
      const from = new Date(`${params.dateFrom}T00:00:00Z`);
      if (!Number.isNaN(from.getTime()) && comparable < from) return false;
    }
    if (params.dateTo) {
      const to = new Date(`${params.dateTo}T23:59:59Z`);
      if (!Number.isNaN(to.getTime()) && comparable > to) return false;
    }
    if (params.q) {
      const term = params.q.trim().toLowerCase();
      if (term) {
        const maybeNumber = Number.parseInt(term, 10);
        const numberMatches = Number.isFinite(maybeNumber) && order.number !== null && order.number === maybeNumber;
        const textHaystack = [
          order.id,
          order.status ?? '',
          order.pendingSince ?? '',
          order.countryCode ?? '',
          order.shop?.name ?? '',
          order.shop?.account?.label ?? '',
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
    const shopLabelParts = [order.shop?.account?.label, order.shop?.name].filter(Boolean) as string[];
    const shopLabel = shopLabelParts.length ? shopLabelParts.join(' • ') : order.shopId;

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
      shopIds: shopLabel ? [shopLabel] : undefined,
      isPrepayment: order.isPrepayment ?? undefined,
    } satisfies Row;
  });
}

function normalizeApiOrder(raw: Record<string, unknown>): Row {
  const fallbackId = Math.random().toString(36).slice(2);
  const id = String(raw.id ?? raw.orderId ?? raw.order_id ?? raw.number ?? raw.orderNumber ?? fallbackId);
  const number =
    raw.number ??
    raw.orderNumber ??
    raw.order_number ??
    raw.displayOrderId ??
    raw.orderId ??
    raw.id;
  const createdRaw =
    raw.createdAt ??
    raw.created_at ??
    raw.created ??
    raw.dateCreated ??
    raw.created_at_utc ??
    raw.orderedAt ??
    raw.ordered_at;
  const updatedRaw =
    raw.updatedAt ??
    raw.updated_at ??
    raw.updated ??
    raw.dateUpdated ??
    raw.lastUpdated ??
    raw.updated_at_utc;

  const createdAt = createdRaw ? new Date(createdRaw as string).toISOString() : new Date().toISOString();
  const updatedAt = updatedRaw ? new Date(updatedRaw as string).toISOString() : undefined;

  const totalAmount =
    (raw.totalAmountLocalCurrency && raw.totalAmountLocalValue
      ? { currency: String(raw.totalAmountLocalCurrency), value: Number(raw.totalAmountLocalValue) }
      : undefined) ??
    (raw.totalAmountCurrency && raw.totalAmount
      ? { currency: String(raw.totalAmountCurrency), value: Number(raw.totalAmount) }
      : undefined) ??
    (raw.totalAmountLocal as Row['totalAmountLocal']);

  const packedItems =
    raw.packedItems ??
    raw.packed_items ??
    raw.packed_qty ??
    raw.fulfilledQuantity ??
    raw.fulfilled_quantity;
  const totalItems =
    raw.totalItems ??
    raw.total_items ??
    raw.totalQuantity ??
    raw.total_quantity ??
    raw.itemsTotal ??
    raw.items_total;

  const shopObject = typeof raw.shop === 'object' && raw.shop !== null ? (raw.shop as Record<string, unknown>) : null;
  const shopNameCandidate =
    (raw.shopName as string | undefined) ??
    (raw.shop_label as string | undefined) ??
    (shopObject?.name as string | undefined) ??
    (Array.isArray(raw.shopIds) ? (raw.shopIds.find((s) => typeof s === 'string') as string | undefined) : undefined) ??
    (typeof raw.shopId === 'string' ? raw.shopId : undefined);

  return {
    id,
    number: number ? String(number) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    pendingSince: raw.pendingSince ? String(raw.pendingSince) : undefined,
    createdAt,
    updatedAt,
    totalItems: totalItems !== undefined ? Number(totalItems) : undefined,
    packedItems: packedItems !== undefined ? Number(packedItems) : undefined,
    totalAmountLocal: totalAmount as Row['totalAmountLocal'],
    shopName: shopNameCandidate,
    shopIds: Array.isArray(raw.shopIds) ? raw.shopIds.filter((s) => typeof s === 'string') as string[] : undefined,
    isPrepayment: typeof raw.isPrepayment === 'boolean' ? raw.isPrepayment : undefined,
  };
}

export default async function OrdersPage(props: unknown) {
  const searchParams: Record<string, string | string[] | undefined> = ((props as { searchParams?: Record<string, string | string[] | undefined> })?.searchParams) || {};
  const toStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawStatus = toStr(searchParams.status);

  const params: Search = {
    status: rawStatus ?? DEFAULT_STATUS,
    country: toStr(searchParams.country),
    shopId: toStr(searchParams.shopId) ?? 'ALL',
    dateFrom: toStr(searchParams.dateFrom),
    dateTo: toStr(searchParams.dateTo),
    q: toStr(searchParams.q),
    nextToken: toStr(searchParams.nextToken),
    size: toStr(searchParams.size),
  };

  const prefersSynced = (params.status ?? '').toUpperCase() === 'PENDING';

  let usedDefaultFrom = false;
  let usedDefaultTo = false;

  if (!prefersSynced) {
    if (!params.dateFrom) {
      try {
        const [firstOrder, firstShop] = await Promise.all([
          prisma.order.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
          prisma.shop.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
        ]);
        const systemStart = firstOrder?.createdAt || firstShop?.createdAt || null;
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const startDate = new Date(Math.max(systemStart ? systemStart.getTime() : 0, threeMonthsAgo.getTime()));
        const iso = Number.isNaN(startDate.getTime()) ? new Date(threeMonthsAgo).toISOString().slice(0, 10) : startDate.toISOString().slice(0, 10);
        params.dateFrom = iso;
        usedDefaultFrom = true;
      } catch {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        params.dateFrom = d.toISOString().slice(0, 10);
        usedDefaultFrom = true;
      }
    }
    if (!params.dateTo) {
      params.dateTo = new Date().toISOString().slice(0, 10);
      usedDefaultTo = true;
    }
  }

  const legacyShopsPromise = prisma.shop.findMany({
    where: { isActive: true, platform: 'JUMIA' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  let syncedShops: Array<{ id: string; name: string; account: { label: string | null } | null }> = [];
  let syncBootstrapError: unknown = null;
  try {
    syncedShops = await prisma.jumiaShop.findMany({
      select: {
        id: true,
        name: true,
        account: { select: { label: true } },
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    syncBootstrapError = error;
    console.error('[orders.page] Failed to load Jumia account directory', error);
  }

  const legacyShops = await legacyShopsPromise;

  const shopOptions = [
    ...legacyShops.map((shop) => ({ id: shop.id, name: shop.name })),
    ...syncedShops.map((shop) => ({ id: shop.id, name: `${shop.account?.label ?? 'Jumia'} • ${shop.name}` })),
  ];

  let rows: Row[] = [];
  let nextToken: string | null = null;
  let isLastPage = true;
  let showingSynced = prefersSynced && !syncBootstrapError;
  let syncFallbackMessage: string | null = syncBootstrapError
    ? 'Cached pending orders are not initialized yet. Showing live data until the next sync completes.'
    : null;

  if (prefersSynced && showingSynced) {
    try {
      rows = await fetchSyncedRows(params);
      nextToken = null;
      isLastPage = true;
    } catch (error) {
      console.error('[orders.page] Failed to load cached pending orders, falling back to live API', error);
      showingSynced = false;
      syncFallbackMessage = 'Cached pending orders are temporarily unavailable. Showing live data instead.';
    }
  }

  if (!showingSynced) {
    const data = await fetchRemoteOrders(params);
    rows = (data.orders || []).map((order) => normalizeApiOrder(order as Record<string, unknown>));
    nextToken = data.nextToken ?? null;
    isLastPage = !!data.isLastPage;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
          <p className="text-slate-300">
            {showingSynced
              ? 'Showing cached PENDING orders synced from Jumia accounts. Filters apply instantly.'
              : 'Filter by status, country, shop, and date range. Use actions to pack, mark RTS, or print labels.'}
          </p>
          {syncFallbackMessage && (
            <p className="text-xs text-amber-400 mt-1">{syncFallbackMessage}</p>
          )}
          {(!showingSynced && (usedDefaultFrom || usedDefaultTo)) && (
            <p className="text-xs text-slate-400 mt-1">
              Default window: last 3 months, bounded by when the system started. Showing {params.dateFrom} to {params.dateTo}.
            </p>
          )}
        </div>
        <div className="pt-1 flex items-center gap-4">
          <OrdersSSE
            status={params.status}
            country={params.country}
            shopId={params.shopId}
            dateFrom={params.dateFrom}
            dateTo={params.dateTo}
            intervalMs={4000}
          />
          <AutoRefresh storageKey="autoRefreshOrders" intervalMs={10000} defaultEnabled={true} />
        </div>
      </div>

      <OrdersFilters shops={shopOptions} />

      <OrdersTable rows={rows} nextToken={nextToken} isLastPage={isLastPage} />
    </div>
  );
}

