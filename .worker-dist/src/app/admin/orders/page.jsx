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
const fetchSyncedRows_1 = require("./_lib/fetchSyncedRows");
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
    const fallbackId = Math.random().toString(36).slice(2);
    const id = String((_e = (_d = (_c = (_b = (_a = raw.id) !== null && _a !== void 0 ? _a : raw.orderId) !== null && _b !== void 0 ? _b : raw.order_id) !== null && _c !== void 0 ? _c : raw.number) !== null && _d !== void 0 ? _d : raw.orderNumber) !== null && _e !== void 0 ? _e : fallbackId);
    const number = (_k = (_j = (_h = (_g = (_f = raw.number) !== null && _f !== void 0 ? _f : raw.orderNumber) !== null && _g !== void 0 ? _g : raw.order_number) !== null && _h !== void 0 ? _h : raw.displayOrderId) !== null && _j !== void 0 ? _j : raw.orderId) !== null && _k !== void 0 ? _k : raw.id;
    const createdRaw = (_r = (_q = (_p = (_o = (_m = (_l = raw.createdAt) !== null && _l !== void 0 ? _l : raw.created_at) !== null && _m !== void 0 ? _m : raw.created) !== null && _o !== void 0 ? _o : raw.dateCreated) !== null && _p !== void 0 ? _p : raw.created_at_utc) !== null && _q !== void 0 ? _q : raw.orderedAt) !== null && _r !== void 0 ? _r : raw.ordered_at;
    const updatedRaw = (_w = (_v = (_u = (_t = (_s = raw.updatedAt) !== null && _s !== void 0 ? _s : raw.updated_at) !== null && _t !== void 0 ? _t : raw.updated) !== null && _u !== void 0 ? _u : raw.dateUpdated) !== null && _v !== void 0 ? _v : raw.lastUpdated) !== null && _w !== void 0 ? _w : raw.updated_at_utc;
    const createdAt = createdRaw ? new Date(createdRaw).toISOString() : new Date().toISOString();
    const updatedAt = updatedRaw ? new Date(updatedRaw).toISOString() : undefined;
    const totalAmount = (_y = (_x = (raw.totalAmountLocalCurrency && raw.totalAmountLocalValue
        ? { currency: String(raw.totalAmountLocalCurrency), value: Number(raw.totalAmountLocalValue) }
        : undefined)) !== null && _x !== void 0 ? _x : (raw.totalAmountCurrency && raw.totalAmount
        ? { currency: String(raw.totalAmountCurrency), value: Number(raw.totalAmount) }
        : undefined)) !== null && _y !== void 0 ? _y : raw.totalAmountLocal;
    const packedItems = (_2 = (_1 = (_0 = (_z = raw.packedItems) !== null && _z !== void 0 ? _z : raw.packed_items) !== null && _0 !== void 0 ? _0 : raw.packed_qty) !== null && _1 !== void 0 ? _1 : raw.fulfilledQuantity) !== null && _2 !== void 0 ? _2 : raw.fulfilled_quantity;
    const totalItems = (_7 = (_6 = (_5 = (_4 = (_3 = raw.totalItems) !== null && _3 !== void 0 ? _3 : raw.total_items) !== null && _4 !== void 0 ? _4 : raw.totalQuantity) !== null && _5 !== void 0 ? _5 : raw.total_quantity) !== null && _6 !== void 0 ? _6 : raw.itemsTotal) !== null && _7 !== void 0 ? _7 : raw.items_total;
    const shopObject = typeof raw.shop === 'object' && raw.shop !== null ? raw.shop : null;
    const shopId = (_9 = (_8 = (typeof raw.shopId === 'string' ? raw.shopId : undefined)) !== null && _8 !== void 0 ? _8 : (Array.isArray(raw.shopIds) ? raw.shopIds.find((s) => typeof s === 'string') : undefined)) !== null && _9 !== void 0 ? _9 : (typeof (shopObject === null || shopObject === void 0 ? void 0 : shopObject.id) === 'string' ? shopObject.id : undefined);
    const shopNameCandidate = (_13 = (_12 = (_11 = (_10 = raw.shopName) !== null && _10 !== void 0 ? _10 : raw.shop_label) !== null && _11 !== void 0 ? _11 : shopObject === null || shopObject === void 0 ? void 0 : shopObject.name) !== null && _12 !== void 0 ? _12 : (Array.isArray(raw.shopIds) ? raw.shopIds.find((s) => typeof s === 'string') : undefined)) !== null && _13 !== void 0 ? _13 : (typeof raw.shopId === 'string' ? raw.shopId : undefined);
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
        shopId: shopId !== null && shopId !== void 0 ? shopId : undefined,
        shopIds: Array.isArray(raw.shopIds) ? raw.shopIds.filter((s) => typeof s === 'string') : undefined,
        isPrepayment: typeof raw.isPrepayment === 'boolean' ? raw.isPrepayment : undefined,
    };
}
async function OrdersPage(props) {
    var _a, _b, _c;
    const searchParams = (props === null || props === void 0 ? void 0 : props.searchParams) || {};
    const toStr = (v) => (Array.isArray(v) ? v[0] : v);
    const rawStatus = toStr(searchParams.status);
    const params = {
        status: rawStatus !== null && rawStatus !== void 0 ? rawStatus : DEFAULT_STATUS,
        country: toStr(searchParams.country),
        shopId: (_a = toStr(searchParams.shopId)) !== null && _a !== void 0 ? _a : 'ALL',
        dateFrom: toStr(searchParams.dateFrom),
        dateTo: toStr(searchParams.dateTo),
        q: toStr(searchParams.q),
        nextToken: toStr(searchParams.nextToken),
        size: toStr(searchParams.size),
    };
    const prefersSynced = ((_b = params.status) !== null && _b !== void 0 ? _b : '').toUpperCase() === 'PENDING';
    // Keep vendor-synced pending views free of implicit date filters.
    // Some orders stay pending for weeks, so forcing a lookback window causes mismatches.
    let kpisPendingCount = null;
    try {
        const metricsUrl = await (0, abs_url_1.absUrl)('/api/metrics/kpis');
        const metricsResp = await fetch(metricsUrl, { cache: 'no-store' });
        if (metricsResp.ok) {
            const metricsJson = await metricsResp.json();
            if (typeof (metricsJson === null || metricsJson === void 0 ? void 0 : metricsJson.pendingAll) === 'number' && Number.isFinite(metricsJson.pendingAll)) {
                kpisPendingCount = Number(metricsJson.pendingAll);
            }
        }
    }
    catch (_d) {
        kpisPendingCount = null;
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
                const systemStart = (firstOrder === null || firstOrder === void 0 ? void 0 : firstOrder.createdAt) || (firstShop === null || firstShop === void 0 ? void 0 : firstShop.createdAt) || null;
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                const startDate = new Date(Math.max(systemStart ? systemStart.getTime() : 0, threeMonthsAgo.getTime()));
                const iso = Number.isNaN(startDate.getTime()) ? new Date(threeMonthsAgo).toISOString().slice(0, 10) : startDate.toISOString().slice(0, 10);
                params.dateFrom = iso;
                usedDefaultFrom = true;
            }
            catch (_e) {
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
    const legacyShopsPromise = prisma_1.prisma.shop.findMany({
        where: { isActive: true, platform: 'JUMIA' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
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
        ...syncedShops.map((shop) => { var _a, _b; return ({ id: shop.id, name: `${(_b = (_a = shop.account) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : 'Jumia'} • ${shop.name}` }); }),
    ];
    let rows = [];
    let nextToken = null;
    let isLastPage = true;
    let showingSynced = prefersSynced && !syncBootstrapError;
    let syncFallbackMessage = syncBootstrapError
        ? 'Cached pending orders are not initialized yet. Showing live data until the next sync completes.'
        : null;
    if (prefersSynced && showingSynced) {
        try {
            rows = await (0, fetchSyncedRows_1.fetchSyncedRows)(params);
            nextToken = null;
            isLastPage = true;
            if (rows.length === 0) {
                showingSynced = false;
                syncFallbackMessage =
                    'No cached pending orders are available yet. Showing live data until the next sync finishes.';
            }
        }
        catch (error) {
            console.error('[orders.page] Failed to load cached pending orders, falling back to live API', error);
            showingSynced = false;
            syncFallbackMessage = 'Cached pending orders are temporarily unavailable. Showing live data instead.';
        }
    }
    if (prefersSynced && showingSynced && kpisPendingCount !== null && kpisPendingCount > rows.length) {
        showingSynced = false;
        syncFallbackMessage = `Cached snapshot is behind vendor count (${rows.length} vs ${kpisPendingCount}). Showing live data until sync catches up.`;
        rows = [];
        nextToken = null;
        isLastPage = false;
    }
    // Defer live remote fetch to the client for faster initial paint when not using cached PENDING
    if (!showingSynced) {
        rows = [];
        nextToken = null;
        isLastPage = false;
    }
    return (<div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
          <p className="text-slate-300">
            {showingSynced
            ? 'Showing cached PENDING orders synced from Jumia accounts. Filters apply instantly.'
            : 'Filter by status, country, shop, and date range. Use actions to pack, mark RTS, or print labels.'}
          </p>
          {syncFallbackMessage && (<p className="text-xs text-amber-400 mt-1">{syncFallbackMessage}</p>)}
          {((!showingSynced && (usedDefaultFrom || usedDefaultTo)) || (showingSynced && (usedDefaultFrom || usedDefaultTo))) && (<p className="text-xs text-slate-400 mt-1">
              Default window: {prefersSynced ? 'last 7 days' : 'last 3 months (bounded by system start)'}.
              Showing {params.dateFrom} to {params.dateTo}.
            </p>)}
        </div>
        <div className="pt-1 flex items-center gap-4">
          <SyncNowButton_1.default />
          <OrdersSSE_1.default status={params.status} country={params.country} shopId={params.shopId} dateFrom={params.dateFrom} dateTo={params.dateTo} intervalMs={4000}/>
          <AutoRefresh_1.default storageKey="autoRefreshOrders" intervalMs={10000} defaultEnabled={true}/>
        </div>
      </div>

      <OrdersFilters_1.default shops={shopOptions}/>

      {/* Client wrapper keeps last non-empty snapshot and updates on SSE/AutoRefresh events */}
      <OrdersLiveData_1.default initialRows={rows} initialNextToken={nextToken} initialIsLastPage={isLastPage} params={{
            status: params.status,
            country: params.country,
            shopId: params.shopId,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            q: params.q,
            // Smaller default page size when aggregating ALL shops to reduce initial payload
            size: (_c = params.size) !== null && _c !== void 0 ? _c : (params.shopId === 'ALL' ? '30' : '50'),
        }} 
    // When using cached PENDING from DB, keep SSR snapshot only (no live fetch)
    disableClientFetch={Boolean(showingSynced)}/>
    </div>);
}
