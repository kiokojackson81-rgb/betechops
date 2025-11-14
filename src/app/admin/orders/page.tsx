import OrdersFilters from './_components/OrdersFilters';
import OrdersLiveData from './_components/OrdersLiveData';
import { absUrl, withParams } from '@/lib/abs-url';
import { prisma } from '@/lib/prisma';
import AutoRefresh from '@/app/_components/AutoRefresh';
import OrdersSSE from './_components/OrdersSSE';
import SyncNowButton from './_components/SyncNowButton';
import BulkActions from './_components/BulkActions';
import { fetchSyncedRows } from './_lib/fetchSyncedRows';
import type { OrdersQuery, OrdersRow } from './_lib/types';
import { isSyncedStatus, normalizeStatus } from '@/lib/jumia/orderStatus';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const DEFAULT_STATUS = 'PENDING';

async function fetchRemoteOrders(params: OrdersQuery) {
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

function normalizeApiOrder(raw: Record<string, unknown>): OrdersRow {
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
    (raw.totalAmountLocal as OrdersRow['totalAmountLocal']);

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
  const shopId =
    (typeof raw.shopId === 'string' ? raw.shopId : undefined) ??
    (Array.isArray(raw.shopIds) ? (raw.shopIds.find((s) => typeof s === 'string') as string | undefined) : undefined) ??
    (typeof shopObject?.id === 'string' ? shopObject.id : undefined);
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
    totalAmountLocal: totalAmount as OrdersRow['totalAmountLocal'],
    shopName: shopNameCandidate,
    shopId: shopId ?? undefined,
    shopIds: Array.isArray(raw.shopIds) ? raw.shopIds.filter((s) => typeof s === 'string') as string[] : undefined,
    isPrepayment: typeof raw.isPrepayment === 'boolean' ? raw.isPrepayment : undefined,
  };
}

export default async function OrdersPage(props: unknown) {
  const headerStore = await headers();
  const searchParams: Record<string, string | string[] | undefined> = ((props as { searchParams?: Record<string, string | string[] | undefined> })?.searchParams) || {};
  const toStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const fallbackQuery = (() => {
    const referer = headerStore.get('referer');
    if (!referer) return null;
    try {
      const parsed = new URL(referer);
      return parsed.searchParams;
    } catch {
      return null;
    }
  })();
  const fallbackGet = (key: string) => fallbackQuery?.get(key) ?? undefined;

  const rawStatus = toStr(searchParams.status) ?? fallbackGet('status');

  const params: OrdersQuery = {
      status: (rawStatus ?? fallbackGet('status')) ?? DEFAULT_STATUS,
      country: toStr(searchParams.country) ?? fallbackGet('country'),
      shopId: (toStr(searchParams.shopId) ?? fallbackGet('shopId')) ?? 'ALL',
      dateFrom: toStr(searchParams.dateFrom) ?? fallbackGet('dateFrom'),
      dateTo: toStr(searchParams.dateTo) ?? fallbackGet('dateTo'),
      q: toStr(searchParams.q) ?? fallbackGet('q'),
      nextToken: toStr(searchParams.nextToken) ?? fallbackGet('nextToken'),
      size: toStr(searchParams.size) ?? fallbackGet('size'),
  };

  const normalizedStatus = normalizeStatus(params.status) ?? DEFAULT_STATUS;
  params.status = normalizedStatus;
  const forceDbSetting = String(process.env.ORDERS_FORCE_DB || process.env.NEXT_PUBLIC_ORDERS_FORCE_DB || "").toLowerCase();
  const forceDbAllStatuses = forceDbSetting === 'always';
  const forceDbEnabled = forceDbSetting !== 'false'; // default: enabled unless explicitly set to "false"
  const isPendingView = normalizedStatus === 'PENDING';
  // Prefer DB for all statuses by default (no env required). Fallback to live if DB has no rows yet.
  const prefersSynced = forceDbEnabled;
  const statusDisplay = normalizedStatus.replace(/_/g, ' ');
  const statusMessageLower = statusDisplay.toLowerCase();
  // Keep vendor-synced pending views free of implicit date filters.
  // Some orders stay pending for weeks, so forcing a lookback window causes mismatches.
  let kpisPendingCount: number | null = null;
  if (isPendingView) {
    try {
      const metricsUrl = await absUrl('/api/metrics/kpis');
      const metricsResp = await fetch(metricsUrl, { cache: 'no-store' });
      if (metricsResp.ok) {
        const metricsJson: any = await metricsResp.json();
        if (typeof metricsJson?.pendingAll === 'number' && Number.isFinite(metricsJson.pendingAll)) {
          kpisPendingCount = Number(metricsJson.pendingAll);
        }
      }
    } catch {
      kpisPendingCount = null;
    }
  }

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

  // Shield legacy shops query so a schema/migration issue doesn't take down the whole page
  const legacyShopsPromise = (async () => {
    try {
      return await prisma.shop.findMany({
        where: { isActive: true, platform: 'JUMIA' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    } catch (e) {
      console.error('[orders.page] legacy shops query failed', e);
      return [] as Array<{ id: string; name: string }>;
    }
  })();

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

  let rows: OrdersRow[] = [];
  let nextToken: string | null = null;
  let isLastPage = true;
  // In DB-only mode, always show synced (database) even if the account directory lookup fails
  let showingSynced = (prefersSynced && !syncBootstrapError) || forceDbAllStatuses;
  let syncFallbackMessage: string | null = syncBootstrapError
    ? `Cached ${statusMessageLower} orders are not initialized yet. Showing live data until the next sync completes.`
    : null;

  if (prefersSynced && showingSynced) {
    try {
      rows = await fetchSyncedRows(params);
      nextToken = null;
      isLastPage = true;
      if (rows.length === 0) {
        showingSynced = false;
        syncFallbackMessage = isPendingView
          ? 'No cached pending orders are available yet. Showing live data until the next sync finishes.'
          : `No cached ${statusMessageLower} orders are available yet. Showing live data until the next sync completes.`;
      }
    } catch (error) {
      console.error('[orders.page] Failed to load cached orders, falling back to live API', error);
      showingSynced = false;
      syncFallbackMessage = `Cached ${statusMessageLower} orders are temporarily unavailable. Showing live data instead.`;
    }
  }

  if (!forceDbAllStatuses && prefersSynced && showingSynced && isPendingView && kpisPendingCount !== null) {
    const diff = Math.abs(kpisPendingCount - rows.length);
    const sample = Math.max(1, Math.min(kpisPendingCount, rows.length));
    const tolerance = Math.max(10, Math.ceil(sample * 0.15));
    const shouldIgnoreZeroKpi = kpisPendingCount === 0 && rows.length > 0;

    if (!shouldIgnoreZeroKpi && diff > tolerance) {
      // Divergence detected: fall back to live refresh but KEEP snapshot rows visible until live data arrives.
      showingSynced = false;
      syncFallbackMessage = `Cached snapshot diverges from vendor by ${diff} (${rows.length} vs ${kpisPendingCount}). Displaying snapshot while refreshing live data.`;
      // Do not clear rows here; client will replace them once live fetch succeeds.
      nextToken = null;
      isLastPage = false;
    }
  }

  // Server-prefetch: when synced Pending is empty, fetch the first live page to avoid blank screen.
  if (!showingSynced && isPendingView && rows.length === 0) {
    try {
      const live = await fetchRemoteOrders({
        ...params,
        // keep the initial size modest to lower TTFB on ALL shops
        size: params.size ?? (params.shopId === 'ALL' ? '30' : '50'),
      });
      const incoming = Array.isArray(live?.orders) ? (live.orders as Array<Record<string, unknown>>).map(normalizeApiOrder) : [];
      if (incoming.length > 0) {
        rows = incoming as OrdersRow[];
        nextToken = typeof live?.nextToken === 'string' || live?.nextToken === null ? (live?.nextToken ?? null) : null;
        isLastPage = typeof live?.isLastPage === 'boolean' ? Boolean(live?.isLastPage) : false;
      }
    } catch (e) {
      // keep empty if live prefetch fails; client will retry
      console.warn('[orders.page] live prefetch failed', e);
    }
  }

  // Defer live remote fetch to the client for faster initial paint when not using cached PENDING
  const preserveRows = !showingSynced && prefersSynced && isPendingView && rows.length > 0;
  if (!showingSynced) {
    if (!preserveRows) {
      rows = [];
      nextToken = null;
      isLastPage = false;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
          <p className="text-slate-300">
            {showingSynced
              ? `Showing synced ${statusMessageLower} orders from Jumia accounts. Filters apply instantly.`
              : 'Filter by status, country, shop, and date range. Use actions to pack, mark RTS, or print labels.'}
          </p>
          {syncFallbackMessage && (
            <p className="text-xs text-amber-400 mt-1">{syncFallbackMessage}</p>
          )}
          {showingSynced && prefersSynced && (
            <p className="text-xs text-slate-400 mt-1">
              {isPendingView
                ? 'Synced pending view uses no fixed date window; showing full vendor-backed range.'
                : 'Synced view shows the rolling 90-day retention window stored in our database.'}
            </p>
          )}
          {!prefersSynced && (usedDefaultFrom || usedDefaultTo) && (
            <p className="text-xs text-slate-400 mt-1">
              {`Default window: last 3 months (bounded by system start). Showing ${params.dateFrom} to ${params.dateTo}.`}
            </p>
          )}
        </div>
        <div className="pt-1 flex items-center gap-4">
          <SyncNowButton />
          <OrdersSSE
            status={params.status}
            country={params.country}
            shopId={params.shopId}
            dateFrom={params.dateFrom}
            dateTo={params.dateTo}
            intervalMs={4000}
          />
          <AutoRefresh storageKey="autoRefreshOrders" intervalMs={10000} defaultEnabled={true} />
          <a
            href="/admin/settings/jumia/shipping-stations"
            className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 text-sm"
            title="Configure per-shop default shipping stations"
          >
            Shipping Stations
          </a>
        </div>
      </div>

      <OrdersFilters shops={shopOptions} />

  {/* Bulk actions: only shows when a specific shop is selected */}
  <BulkActions />

      {/* Client wrapper keeps last non-empty snapshot and updates on SSE/AutoRefresh events */}
      <OrdersLiveData
        initialRows={rows}
        initialNextToken={nextToken}
        initialIsLastPage={isLastPage}
        params={{
          status: params.status,
          country: params.country,
          shopId: params.shopId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          q: params.q,
          // Smaller default page size when aggregating ALL shops to reduce initial payload
          size: params.size ?? (params.shopId === 'ALL' ? '30' : '50'),
        }}
        // When using cached PENDING from DB, keep SSR snapshot only (no live fetch)
        disableClientFetch={Boolean(showingSynced)}
      />
    </div>
  );
}

