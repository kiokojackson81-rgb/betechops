"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = OrdersPage;
const OrdersFilters_1 = __importDefault(require("./_components/OrdersFilters"));
const OrdersLiveData_1 = __importDefault(require("./_components/OrdersLiveData"));
const abs_url_1 = require("@/lib/abs-url");
const prisma_1 = require("@/lib/prisma");
const AutoRefresh_1 = __importDefault(require("@/app/_components/AutoRefresh"));
const OrdersSSE_1 = __importDefault(require("./_components/OrdersSSE"));
const SyncNowButton_1 = __importDefault(require("./_components/SyncNowButton"));
const BulkActions_1 = __importDefault(require("./_components/BulkActions"));
const fetchSyncedRows_1 = require("./_lib/fetchSyncedRows");
const orderStatus_1 = require("@/lib/jumia/orderStatus");
const headers_1 = require("next/headers");
exports.dynamic = 'force-dynamic';
const DEFAULT_STATUS = 'PENDING';
async function fetchRemoteOrders(params) {
    const base = await (0, abs_url_1.absUrl)('/api/orders');
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL')
        query.set('status', params.status);
    if (params.country)
        query.set('country', params.country);
    if (params.shopId)
        query.set('shopId', params.shopId);
    if (params.dateFrom)
        query.set('dateFrom', params.dateFrom);
    if (params.dateTo)
        query.set('dateTo', params.dateTo);
    if (params.q)
        query.set('q', params.q);
    if (params.nextToken)
        query.set('nextToken', params.nextToken);
    if (params.size)
        query.set('size', params.size);
    const url = (0, abs_url_1.withParams)(base, Object.fromEntries(query.entries()));
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok)
        throw new Error('Failed to load orders');
    return res.json();
}
function normalizeApiOrder(raw) {
    const fallbackId = Math.random().toString(36).slice(2);
    const id = String(raw.id ?? raw.orderId ?? raw.order_id ?? raw.number ?? raw.orderNumber ?? fallbackId);
    const number = raw.number ??
        raw.orderNumber ??
        raw.order_number ??
        raw.displayOrderId ??
        raw.orderId ??
        raw.id;
    const createdRaw = raw.createdAt ??
        raw.created_at ??
        raw.created ??
        raw.dateCreated ??
        raw.created_at_utc ??
        raw.orderedAt ??
        raw.ordered_at;
    const updatedRaw = raw.updatedAt ??
        raw.updated_at ??
        raw.updated ??
        raw.dateUpdated ??
        raw.lastUpdated ??
        raw.updated_at_utc;
    const createdAt = createdRaw ? new Date(createdRaw).toISOString() : new Date().toISOString();
    const updatedAt = updatedRaw ? new Date(updatedRaw).toISOString() : undefined;
    const totalAmount = (raw.totalAmountLocalCurrency && raw.totalAmountLocalValue
        ? { currency: String(raw.totalAmountLocalCurrency), value: Number(raw.totalAmountLocalValue) }
        : undefined) ??
        (raw.totalAmountCurrency && raw.totalAmount
            ? { currency: String(raw.totalAmountCurrency), value: Number(raw.totalAmount) }
            : undefined) ??
        raw.totalAmountLocal;
    const packedItems = raw.packedItems ??
        raw.packed_items ??
        raw.packed_qty ??
        raw.fulfilledQuantity ??
        raw.fulfilled_quantity;
    const totalItems = raw.totalItems ??
        raw.total_items ??
        raw.totalQuantity ??
        raw.total_quantity ??
        raw.itemsTotal ??
        raw.items_total;
    const shopObject = typeof raw.shop === 'object' && raw.shop !== null ? raw.shop : null;
    const shopId = (typeof raw.shopId === 'string' ? raw.shopId : undefined) ??
        (Array.isArray(raw.shopIds) ? raw.shopIds.find((s) => typeof s === 'string') : undefined) ??
        (typeof shopObject?.id === 'string' ? shopObject.id : undefined);
    const shopNameCandidate = raw.shopName ??
        raw.shop_label ??
        shopObject?.name ??
        (Array.isArray(raw.shopIds) ? raw.shopIds.find((s) => typeof s === 'string') : undefined) ??
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
        totalAmountLocal: totalAmount,
        shopName: shopNameCandidate,
        shopId: shopId ?? undefined,
        shopIds: Array.isArray(raw.shopIds) ? raw.shopIds.filter((s) => typeof s === 'string') : undefined,
        isPrepayment: typeof raw.isPrepayment === 'boolean' ? raw.isPrepayment : undefined,
    };
}
async function OrdersPage(props) {
    const headerStore = await (0, headers_1.headers)();
    const searchParams = (props?.searchParams) || {};
    const toStr = (v) => (Array.isArray(v) ? v[0] : v);
    const fallbackQuery = (() => {
        const referer = headerStore.get('referer');
        if (!referer)
            return null;
        try {
            const parsed = new URL(referer);
            return parsed.searchParams;
        }
        catch {
            return null;
        }
    })();
    const fallbackGet = (key) => fallbackQuery?.get(key) ?? undefined;
    const rawStatus = toStr(searchParams.status) ?? fallbackGet('status');
    const params = {
        status: (rawStatus ?? fallbackGet('status')) ?? DEFAULT_STATUS,
        country: toStr(searchParams.country) ?? fallbackGet('country'),
        shopId: (toStr(searchParams.shopId) ?? fallbackGet('shopId')) ?? 'ALL',
        dateFrom: toStr(searchParams.dateFrom) ?? fallbackGet('dateFrom'),
        dateTo: toStr(searchParams.dateTo) ?? fallbackGet('dateTo'),
        q: toStr(searchParams.q) ?? fallbackGet('q'),
        nextToken: toStr(searchParams.nextToken) ?? fallbackGet('nextToken'),
        size: toStr(searchParams.size) ?? fallbackGet('size'),
    };
    const normalizedStatus = (0, orderStatus_1.normalizeStatus)(params.status) ?? DEFAULT_STATUS;
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
    let kpisPendingCount = null;
    if (isPendingView) {
        try {
            const metricsUrl = await (0, abs_url_1.absUrl)('/api/metrics/kpis');
            const metricsResp = await fetch(metricsUrl, { cache: 'no-store' });
            if (metricsResp.ok) {
                const metricsJson = await metricsResp.json();
                if (typeof metricsJson?.pendingAll === 'number' && Number.isFinite(metricsJson.pendingAll)) {
                    kpisPendingCount = Number(metricsJson.pendingAll);
                }
            }
        }
        catch {
            kpisPendingCount = null;
        }
    }
    let usedDefaultFrom = false;
    let usedDefaultTo = false;
    if (!prefersSynced) {
        if (!params.dateFrom) {
            try {
                const [firstOrder, firstShop] = await Promise.all([
                    prisma_1.prisma.order.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
                    prisma_1.prisma.shop.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
                ]);
                const systemStart = firstOrder?.createdAt || firstShop?.createdAt || null;
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                const startDate = new Date(Math.max(systemStart ? systemStart.getTime() : 0, threeMonthsAgo.getTime()));
                const iso = Number.isNaN(startDate.getTime()) ? new Date(threeMonthsAgo).toISOString().slice(0, 10) : startDate.toISOString().slice(0, 10);
                params.dateFrom = iso;
                usedDefaultFrom = true;
            }
            catch {
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
            return await prisma_1.prisma.shop.findMany({
                where: { isActive: true, platform: 'JUMIA' },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            });
        }
        catch (e) {
            console.error('[orders.page] legacy shops query failed', e);
            return [];
        }
    })();
    let syncedShops = [];
    let syncBootstrapError = null;
    try {
        syncedShops = await prisma_1.prisma.jumiaShop.findMany({
            select: {
                id: true,
                name: true,
                account: { select: { label: true } },
            },
            orderBy: { name: 'asc' },
        });
    }
    catch (error) {
        syncBootstrapError = error;
        console.error('[orders.page] Failed to load Jumia account directory', error);
    }
    const legacyShops = await legacyShopsPromise;
    const shopOptions = [
        ...legacyShops.map((shop) => ({ id: shop.id, name: shop.name })),
        ...syncedShops.map((shop) => ({ id: shop.id, name: `${shop.account?.label ?? 'Jumia'} • ${shop.name}` })),
    ];
    let rows = [];
    let nextToken = null;
    let isLastPage = true;
    // In DB-only mode, always show synced (database) even if the account directory lookup fails
    let showingSynced = (prefersSynced && !syncBootstrapError) || forceDbAllStatuses;
    let syncFallbackMessage = syncBootstrapError
        ? `Cached ${statusMessageLower} orders are not initialized yet. Showing live data until the next sync completes.`
        : null;
    if (prefersSynced && showingSynced) {
        try {
            rows = await (0, fetchSyncedRows_1.fetchSyncedRows)(params);
            nextToken = null;
            isLastPage = true;
            if (rows.length === 0) {
                showingSynced = false;
                syncFallbackMessage = isPendingView
                    ? 'No cached pending orders are available yet. Showing live data until the next sync finishes.'
                    : `No cached ${statusMessageLower} orders are available yet. Showing live data until the next sync completes.`;
            }
        }
        catch (error) {
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
    // Disable any live prefetch for Pending: keep DB-only for a deterministic first paint.
    // If DB has no rows yet, we'll show empty and let the background sync populate soon.
    // Defer live remote fetch to the client for faster initial paint when not using cached PENDING
    const preserveRows = !showingSynced && prefersSynced && isPendingView && rows.length > 0;
    if (!showingSynced) {
        if (!preserveRows) {
            rows = [];
            nextToken = null;
            isLastPage = false;
        }
    }
    return (<div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
          <p className="text-slate-300">
            {showingSynced
            ? `Showing synced ${statusMessageLower} orders from Jumia accounts. Filters apply instantly.`
            : 'Filter by status, country, shop, and date range. Use actions to pack, mark RTS, or print labels.'}
          </p>
          {syncFallbackMessage && (<p className="text-xs text-amber-400 mt-1">{syncFallbackMessage}</p>)}
          {showingSynced && prefersSynced && (<p className="text-xs text-slate-400 mt-1">
              {isPendingView
                ? 'Synced pending view uses no fixed date window; showing full vendor-backed range.'
                : 'Synced view shows the rolling 90-day retention window stored in our database.'}
            </p>)}
          {!prefersSynced && (usedDefaultFrom || usedDefaultTo) && (<p className="text-xs text-slate-400 mt-1">
              {`Default window: last 3 months (bounded by system start). Showing ${params.dateFrom} to ${params.dateTo}.`}
            </p>)}
        </div>
        <div className="pt-1 flex items-center gap-4">
          <SyncNowButton_1.default />
          <OrdersSSE_1.default status={params.status} country={params.country} shopId={params.shopId} dateFrom={params.dateFrom} dateTo={params.dateTo} intervalMs={4000}/>
          <AutoRefresh_1.default storageKey="autoRefreshOrders" intervalMs={10000} defaultEnabled={true}/>
          <a href="/admin/settings/jumia/shipping-stations" className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 text-sm" title="Configure per-shop default shipping stations">
            Shipping Stations
          </a>
        </div>
      </div>

      <OrdersFilters_1.default shops={shopOptions}/>

  {/* Bulk actions: only shows when a specific shop is selected */}
  <BulkActions_1.default />

      {/* Client wrapper keeps last non-empty snapshot and updates on SSE/AutoRefresh events */}
      <OrdersLiveData_1.default initialRows={rows} initialNextToken={nextToken} initialIsLastPage={isLastPage} params={{
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
    disableClientFetch={Boolean(showingSynced)}/>
    </div>);
}
