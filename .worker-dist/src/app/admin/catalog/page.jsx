"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = CatalogPage;
exports.dynamic = "force-dynamic";
const jumia_1 = require("@/lib/jumia");
const headers_1 = require("next/headers");
const CountsRefreshButton_1 = __importDefault(require("@/app/_components/CountsRefreshButton"));
const CatalogMetrics_1 = __importDefault(require("@/app/_components/CatalogMetrics"));
const AutoRefresh_1 = __importDefault(require("@/app/_components/AutoRefresh"));
const prisma_1 = require("@/lib/prisma");
const DEFAULT_TIMEOUT = 8000;
async function withTimeout(promise, ms = DEFAULT_TIMEOUT, fallback = undefined) {
    return await Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(typeof fallback === "function" ? fallback() : fallback), ms)),
    ]);
}
function normalize(value) {
    if (value === undefined || value === null)
        return "";
    return String(value).trim().toLowerCase();
}
function productStatus(product) {
    return normalize(product?.status ?? product?.itemStatus ?? product?.productStatus ?? product?.state) || "unknown";
}
function productQcStatus(product) {
    const raw = firstDefined([
        product?.qcStatus,
        asRecord(product?.qualityControl).status,
        asRecord(product?.quality_control).status,
        product?.qualityCheckStatus,
        product?.quality_control_status,
        asRecord(product?.qc).status,
        product?.qc_status,
        product?.qcstatus,
        product?.qcStatusName,
        product?.qc_status_name,
    ]);
    return normalize(raw);
}
function formatLabel(value) {
    if (!value)
        return "-";
    return value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
const listingStatusAliases = {
    active: ["active", "live"],
    inactive: ["inactive", "disabled", "blocked", "not_live", "not live"],
    deleted: ["deleted"],
    pending: ["pending", "pending_activation"],
};
const qcStatusAliases = {
    approved: ["approved"],
    pending: ["pending", "pending_qc"],
    not_ready_to_qc: ["not_ready_to_qc", "not ready to qc", "not-ready-to-qc"],
    rejected: ["rejected"],
};
function resolveAlias(filter, map) {
    if (!filter)
        return null;
    if (map[filter])
        return map[filter];
    for (const [, aliases] of Object.entries(map)) {
        if (aliases.includes(filter))
            return aliases;
    }
    return [filter];
}
function bucketSum(source, keys) {
    return keys.reduce((acc, key) => acc + (source[key] || 0), 0);
}
function matchesListingStatus(status, filter) {
    if (!filter)
        return true;
    const aliases = resolveAlias(filter, listingStatusAliases) ?? [filter];
    return aliases.some((alias) => status.includes(alias));
}
function matchesQcStatus(status, filter) {
    if (!filter)
        return true;
    const aliases = resolveAlias(filter, qcStatusAliases) ?? [filter];
    return aliases.some((alias) => status.includes(alias));
}
function formatNumber(value) {
    return Number.isFinite(value) ? value.toLocaleString("en-US") : "-";
}
function formatCurrency(value, currency) {
    if (value === undefined || value === null || Number.isNaN(value))
        return "-";
    if (!currency)
        return value.toLocaleString("en-US");
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
    }
    catch {
        return `${currency.toUpperCase()} ${value.toLocaleString("en-US")}`;
    }
}
function formatDateTime(value) {
    if (!value)
        return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value;
    return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
function numeric(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value === "number")
        return Number.isFinite(value) ? value : undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function firstDefined(values) {
    for (const value of values) {
        if (value !== undefined && value !== null)
            return value;
    }
    return undefined;
}
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
function extractProducts(response) {
    if (!response || typeof response !== "object")
        return [];
    const record = response;
    const products = record.products;
    if (Array.isArray(products))
        return products;
    const items = record.items;
    if (Array.isArray(items))
        return items;
    const data = record.data;
    if (Array.isArray(data))
        return data;
    return [];
}
function extractCategories(response) {
    if (!response || typeof response !== "object")
        return [];
    const record = response;
    const categories = record.categories;
    if (Array.isArray(categories))
        return categories;
    const items = record.items;
    if (Array.isArray(items))
        return items;
    const data = record.data;
    if (Array.isArray(data))
        return data;
    return [];
}
const EMPTY_SUMMARY = { total: 0, approx: true, byStatus: {}, byQcStatus: {} };
function normalizeProduct(product, shops) {
    const sellerSkuCandidate = product.sellerSku ?? product.sellerSKU ?? product.sku ?? product.sid ?? product.id ?? `SKU-${Math.random().toString(16).slice(2)}`;
    const nameCandidate = product.name ?? product.title ?? product.productName ?? product.displayName;
    const name = typeof nameCandidate === "string"
        ? nameCandidate
        : typeof nameCandidate?.value === "string"
            ? String(nameCandidate.value)
            : "-";
    const rawPrice = product.price;
    const priceRecord = asRecord(rawPrice);
    const saleRecord = asRecord(priceRecord.salePrice ?? product.salePrice);
    const saleFallback = product.salePrice;
    const priceValue = numeric(rawPrice) ??
        numeric(priceRecord.value) ??
        numeric(priceRecord.amount) ??
        numeric(priceRecord.price) ??
        numeric(product.priceValue);
    const salePriceValue = numeric(saleFallback) ??
        numeric(saleRecord.value) ??
        numeric(saleRecord.amount) ??
        numeric(saleRecord.price) ??
        numeric(product.salePriceValue);
    const currencyCandidate = priceRecord.currency ??
        saleRecord.currency ??
        product.currency ??
        (Array.isArray(product.prices) ? product.prices[0]?.currency : undefined);
    const currency = typeof currencyCandidate === "string" ? currencyCandidate : undefined;
    const stockRecord = asRecord(product.stock);
    const qtyCandidate = product.quantity ??
        product.stock ??
        product.availableQuantity ??
        product.globalStock ??
        product.inventory ??
        product.lastKnownStock ??
        stockRecord.value;
    const quantity = numeric(qtyCandidate);
    const priceUpdated = asRecord(product.price).updatedAt;
    const stockUpdated = asRecord(product.stock).updatedAt;
    const updatedAtCandidate = product.updatedAt ?? product.lastUpdatedAt ?? priceUpdated ?? stockUpdated ?? product.lastStockUpdatedAt ?? product.createdAt ?? undefined;
    const statusKey = productStatus(product);
    const qcStatusKey = productQcStatus(product);
    const shopRef = asRecord(product._shop);
    const nestedShop = asRecord(product.shop);
    const shopIdRaw = shopRef.id ?? nestedShop.id ?? product.shopId ?? nestedShop.sid ?? product.shopSid ?? nestedShop.shopId;
    const shopId = shopIdRaw !== undefined && shopIdRaw !== null ? String(shopIdRaw) : undefined;
    const shopNameCandidate = (typeof shopRef.name === "string" ? shopRef.name : undefined) ??
        (typeof nestedShop.name === "string" ? nestedShop.name : undefined) ??
        (shopId ? shops.get(shopId) : undefined);
    const shopName = typeof shopNameCandidate === "string" ? shopNameCandidate : "-";
    return {
        key: String(product.id ?? product.sid ?? sellerSkuCandidate ?? Math.random().toString(16).slice(2)),
        sellerSku: String(sellerSkuCandidate ?? "-"),
        name,
        statusKey,
        qcStatusKey,
        shopName,
        priceValue,
        salePriceValue,
        currency,
        quantity,
        updatedAt: typeof updatedAtCandidate === "string" ? updatedAtCandidate : undefined,
    };
}
function badgeClasses(kind, statusKey) {
    if (kind === "listing") {
        if (matchesListingStatus(statusKey, "active"))
            return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
        if (matchesListingStatus(statusKey, "inactive"))
            return "border-slate-400/30 bg-slate-500/15 text-slate-100";
        if (matchesListingStatus(statusKey, "deleted"))
            return "border-rose-400/30 bg-rose-600/15 text-rose-100";
        if (matchesListingStatus(statusKey, "pending"))
            return "border-amber-400/30 bg-amber-500/15 text-amber-100";
        return "border-white/15 bg-white/5 text-slate-100";
    }
    if (matchesQcStatus(statusKey, "approved"))
        return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
    if (matchesQcStatus(statusKey, "pending"))
        return "border-amber-400/30 bg-amber-500/15 text-amber-100";
    if (matchesQcStatus(statusKey, "not_ready_to_qc"))
        return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    if (matchesQcStatus(statusKey, "rejected"))
        return "border-rose-400/30 bg-rose-600/15 text-rose-100";
    return "border-white/15 bg-white/5 text-slate-100";
}
function metricTone(tone) {
    switch (tone) {
        case "positive":
            return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
        case "warning":
            return "border-amber-400/20 bg-amber-500/10 text-amber-100";
        case "danger":
            return "border-rose-400/20 bg-rose-600/10 text-rose-100";
        case "muted":
            return "border-slate-400/20 bg-slate-600/10 text-slate-100";
        default:
            return "border-white/15 bg-white/5 text-white";
    }
}
function buildQueryString(params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null)
            continue;
        const text = String(value).trim();
        if (text)
            query.set(key, text);
    }
    return query.toString();
}
async function CatalogPage({ searchParams }) {
    const sp = (await searchParams) || {};
    const size = Math.min(100, Math.max(1, Number(sp.size || 20)));
    const sellerSku = (sp.sellerSku || "").trim() || undefined;
    const categoryCode = sp.categoryCode ? Number(sp.categoryCode) : undefined;
    const token = (sp.token || "").trim() || undefined;
    const shopId = (sp.shopId || "ALL").toString();
    const exactFlag = String(sp.exact || "").toLowerCase();
    const exact = exactFlag === "1" || exactFlag === "true" || exactFlag === "yes";
    const rawStatus = normalize(sp.status);
    const rawQcStatus = normalize(sp.qcStatus);
    let listingStatusFilter = rawStatus || undefined;
    let qcStatusFilter = rawQcStatus || undefined;
    if (listingStatusFilter && listingStatusFilter.startsWith("qc:")) {
        qcStatusFilter = normalize(listingStatusFilter.slice(3)) || undefined;
        listingStatusFilter = undefined;
    }
    const [shops, categoriesResponse] = await Promise.all([
        prisma_1.prisma.shop.findMany({
            where: { isActive: true, platform: "JUMIA" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        withTimeout((0, jumia_1.getCatalogCategories)(1), DEFAULT_TIMEOUT).catch(() => undefined),
    ]);
    const categories = extractCategories(categoriesResponse).slice(0, 18);
    const shopLookup = new Map(shops.map((shop) => [shop.id, shop.name]));
    let rawProducts = [];
    let nextToken = "";
    let summary = EMPTY_SUMMARY;
    async function fetchCountsFromApi(all, sid, exactMode, sizeHint) {
        try {
            const h = await (0, headers_1.headers)();
            const host = h.get("x-forwarded-host") || h.get("host") || process.env.NEXT_PUBLIC_VERCEL_URL || "localhost:3000";
            const proto = h.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
            const base = host.startsWith("http") ? host : `${proto}://${host}`;
            const qs = new URLSearchParams();
            if (all)
                qs.set("all", "true");
            else
                qs.set("shopId", sid);
            if (exactMode)
                qs.set("exact", "true");
            qs.set("size", String(Math.max(1, sizeHint)));
            const url = `${base}/api/catalog/products-count?${qs.toString()}`;
            const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
            if (!res.ok)
                return null;
            const j = (await res.json());
            if (typeof j?.total === "number")
                return { total: j.total, approx: !!j.approx, byStatus: j.byStatus || {}, byQcStatus: j.byQcStatus || {} };
            return null;
        }
        catch {
            return null;
        }
    }
    if (shopId.toUpperCase() === "ALL") {
        // Performance: Avoid fanning out product fetches across all shops on initial load.
        // This significantly slows the page when many shops exist. Show only counters and categories for ALL.
        rawProducts = [];
        nextToken = "";
        const fromApi = await fetchCountsFromApi(true, "", exact, exact ? Math.min(100, Math.max(size, 50)) : Math.min(100, Math.max(size, 50)));
        if (fromApi) {
            summary = fromApi;
        }
        else if (exact) {
            const exactTotals = await (await Promise.resolve().then(() => __importStar(require("@/lib/jumia")))).getCatalogProductsCountExactAll({ size: Math.min(100, Math.max(size, 50)) }).catch(() => EMPTY_SUMMARY);
            summary = exactTotals;
        }
        else {
            const counts = await Promise.allSettled(shops.map((shop) => (0, jumia_1.getCatalogProductsCountQuickForShop)({ shopId: shop.id, limitPages: 4, size: Math.max(size, 50), timeMs: 12000 })));
            const byStatus = {};
            const byQcStatus = {};
            let total = 0;
            let approx = shops.length > 0 ? false : true;
            for (const result of counts) {
                if (result.status === "fulfilled") {
                    const value = result.value;
                    total += value.total;
                    approx = approx || value.approx;
                    for (const [key, count] of Object.entries(value.byStatus || {})) {
                        byStatus[key] = (byStatus[key] || 0) + count;
                    }
                    for (const [key, count] of Object.entries(value.byQcStatus || {})) {
                        byQcStatus[key] = (byQcStatus[key] || 0) + count;
                    }
                }
                else {
                    approx = true;
                }
            }
            summary = { total, approx, byStatus, byQcStatus };
        }
    }
    else {
        const [productsResponse, apiSummary] = await Promise.all([
            withTimeout((0, jumia_1.getCatalogProducts)({ size, token, sellerSku, categoryCode, shopId }), DEFAULT_TIMEOUT).catch(() => undefined),
            fetchCountsFromApi(false, shopId, exact, exact ? Math.min(100, Math.max(size, 50)) : Math.min(100, Math.max(size, 50))),
        ]);
        rawProducts = extractProducts(productsResponse).map((item) => ({
            ...item,
            _shop: { id: shopId, name: shopLookup.get(shopId) },
        }));
        nextToken = String(productsResponse?.nextToken ?? productsResponse?.token ?? productsResponse?.next ?? "") || "";
        if (apiSummary) {
            summary = apiSummary;
        }
        else {
            summary = await (exact
                ? (await Promise.resolve().then(() => __importStar(require("@/lib/jumia")))).getCatalogProductsCountExactForShop({ shopId, size: Math.min(100, Math.max(size, 50)) }).catch(() => EMPTY_SUMMARY)
                : (0, jumia_1.getCatalogProductsCountQuickForShop)({ shopId, limitPages: 6, size: Math.min(100, Math.max(size, 50)), timeMs: 15000 }).catch(() => EMPTY_SUMMARY));
        }
    }
    const filteredProducts = rawProducts
        .filter((product) => matchesListingStatus(productStatus(product), listingStatusFilter))
        .filter((product) => matchesQcStatus(productQcStatus(product), qcStatusFilter));
    const normalizedProducts = filteredProducts
        .map((product) => normalizeProduct(product, shopLookup))
        .sort((a, b) => {
        if (a.updatedAt && b.updatedAt) {
            const da = new Date(a.updatedAt).getTime();
            const db = new Date(b.updatedAt).getTime();
            if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db)
                return db - da;
        }
        return a.name.localeCompare(b.name);
    });
    const listingMetrics = {
        active: bucketSum(summary.byStatus, listingStatusAliases.active),
        inactive: bucketSum(summary.byStatus, listingStatusAliases.inactive),
        deleted: bucketSum(summary.byStatus, listingStatusAliases.deleted),
        pending: bucketSum(summary.byStatus, listingStatusAliases.pending),
    };
    const qcMetrics = {
        approved: bucketSum(summary.byQcStatus, qcStatusAliases.approved),
        pending: bucketSum(summary.byQcStatus, qcStatusAliases.pending),
        notReady: bucketSum(summary.byQcStatus, qcStatusAliases.not_ready_to_qc),
        rejected: bucketSum(summary.byQcStatus, qcStatusAliases.rejected),
    };
    const metricsCards = [
        { key: "total", label: "Total products", value: summary.total, tone: undefined },
        { key: "active", label: "Active", value: listingMetrics.active, tone: "positive" },
        { key: "inactive", label: "Inactive / Disabled", value: listingMetrics.inactive, tone: "muted" },
        { key: "qc-approved", label: "QC Approved", value: qcMetrics.approved, tone: "positive" },
        { key: "qc-pending", label: "QC Pending", value: qcMetrics.pending + qcMetrics.notReady, tone: "warning" },
        { key: "qc-rejected", label: "QC Rejected", value: qcMetrics.rejected, tone: "danger" },
    ];
    const listingStatusChips = [
        { key: "list-all", label: "All Listings", count: summary.total, param: { status: undefined }, aliases: [] },
        { key: "list-active", label: "Active", count: listingMetrics.active, param: { status: "active" }, aliases: listingStatusAliases.active },
        { key: "list-inactive", label: "Inactive", count: listingMetrics.inactive, param: { status: "inactive" }, aliases: listingStatusAliases.inactive },
        { key: "list-pending", label: "Pending Activation", count: listingMetrics.pending, param: { status: "pending" }, aliases: listingStatusAliases.pending },
        { key: "list-deleted", label: "Deleted", count: listingMetrics.deleted, param: { status: "deleted" }, aliases: listingStatusAliases.deleted },
    ];
    const qcStatusChips = [
        { key: "qc-all", label: "All QC", count: summary.total, param: { qcStatus: undefined }, aliases: [] },
        { key: "qc-pending", label: "Pending QC", count: qcMetrics.pending, param: { qcStatus: "pending" }, aliases: qcStatusAliases.pending },
        { key: "qc-not-ready", label: "Not Ready to QC", count: qcMetrics.notReady, param: { qcStatus: "not_ready_to_qc" }, aliases: qcStatusAliases.not_ready_to_qc },
        { key: "qc-approved", label: "Approved", count: qcMetrics.approved, param: { qcStatus: "approved" }, aliases: qcStatusAliases.approved },
        { key: "qc-rejected", label: "Rejected", count: qcMetrics.rejected, param: { qcStatus: "rejected" }, aliases: qcStatusAliases.rejected },
    ];
    const baseQuery = {
        shopId,
        sellerSku,
        categoryCode: categoryCode ? String(categoryCode) : undefined,
        size: String(size),
        status: listingStatusFilter,
        qcStatus: qcStatusFilter,
    };
    const selectedShopName = shopId.toUpperCase() === "ALL" ? "All Jumia shops" : shopLookup.get(shopId) ?? "Selected shop";
    const renderChip = (chip, kind) => {
        const currentFilter = kind === "status" ? listingStatusFilter : qcStatusFilter;
        const hasFilter = currentFilter !== undefined && currentFilter !== "";
        const isActive = chip.param.status === undefined && chip.param.qcStatus === undefined
            ? !hasFilter && (kind === "status" ? !listingStatusFilter : !qcStatusFilter)
            : !!(currentFilter && (currentFilter === (kind === "status" ? chip.param.status : chip.param.qcStatus) || chip.aliases?.includes(currentFilter)));
        const href = `/admin/catalog?${buildQueryString({
            ...baseQuery,
            status: kind === "status" ? chip.param.status : baseQuery.status,
            qcStatus: kind === "qc" ? chip.param.qcStatus : baseQuery.qcStatus,
        })}`;
        return (<a key={chip.key} href={href} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${isActive ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" : "border-white/15 bg-white/5 text-slate-100 hover:border-white/25"}`}>
        <span>{chip.label}</span>
        {chip.count !== undefined ? <span className="text-xs text-slate-300">{formatNumber(chip.count)}</span> : null}
      </a>);
    };
    return (<div className="space-y-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Catalog</h1>
        <p className="text-sm text-slate-300">
          {selectedShopName}
          {!exact && summary.approx ? <span className="ml-2 text-amber-300">Counts are approximate (first few pages).</span> : null}
        </p>
      </header>

      <CatalogMetrics_1.default initial={summary} shopId={shopId} exact={exact}/>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-300">QC Status</div>
          <div className="mt-2 flex flex-wrap gap-2">{qcStatusChips.map((chip) => renderChip(chip, "qc"))}</div>
        </div>
        <div className="border-t border-white/10 pt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-300">Listing Status</div>
          <div className="mt-2 flex flex-wrap gap-2">{listingStatusChips.map((chip) => renderChip(chip, "status"))}</div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input type="hidden" name="status" value={listingStatusFilter ?? ""}/>
          <input type="hidden" name="qcStatus" value={qcStatusFilter ?? ""}/>
          <input type="hidden" name="exact" value={exact ? "true" : ""}/>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-300">Shop</label>
            <select name="shopId" defaultValue={shopId} className="rounded border border-white/15 bg-slate-900/60 px-3 py-2 text-sm">
              <option value="ALL">All Jumia</option>
              {shops.map((shop) => (<option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-300">Seller SKU</label>
            <input name="sellerSku" defaultValue={sellerSku ?? ""} placeholder="Search by SKU" className="rounded border border-white/15 bg-slate-900/60 px-3 py-2 text-sm"/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-300">Category Code</label>
            <input name="categoryCode" defaultValue={categoryCode ? String(categoryCode) : ""} placeholder="e.g. 1000007" className="rounded border border-white/15 bg-slate-900/60 px-3 py-2 text-sm"/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-300">Page Size</label>
            <select name="size" defaultValue={String(size)} className="rounded border border-white/15 bg-slate-900/60 px-3 py-2 text-sm">
              {[20, 50, 100].map((n) => (<option key={n} value={n}>
                  {n}
                </option>))}
            </select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
            <button className="rounded border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/30">
              Apply
            </button>
            <a href="/admin/catalog" className="rounded border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:border-white/25">
              Clear
            </a>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Categories</h2>
          {categoryCode ? (<a href={`/admin/catalog?${buildQueryString({ ...baseQuery, categoryCode: undefined, token: undefined })}`} className="text-xs text-emerald-200 underline">
              Clear category
            </a>) : null}
        </div>
        {categories.length === 0 ? (<p className="text-sm text-slate-400">No categories available.</p>) : (<div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category, index) => {
                const code = Number(category?.code ?? category?.categoryCode ?? index);
                const rawLabel = category?.name ?? category?.categoryName ?? category?.title ?? `Category ${index + 1}`;
                const label = typeof rawLabel === "string" ? rawLabel : String(rawLabel);
                const isActive = categoryCode !== undefined && code === categoryCode;
                const href = `/admin/catalog?${buildQueryString({
                    ...baseQuery,
                    categoryCode: code,
                    token: undefined,
                })}`;
                return (<a key={`cat-${code}-${label}`} href={href} className={`min-w-[180px] rounded-lg border px-3 py-2 text-sm transition-colors ${isActive
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                        : "border-white/15 bg-white/5 text-slate-100 hover:border-white/25"}`}>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-slate-300">Code: {code}</div>
                </a>);
            })}
          </div>)}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Products</h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {token ? <span>token: {token.slice(0, 6)}…</span> : null}
            <AutoRefresh_1.default eventName="catalog:counts:refresh" storageKey="catalogAutoRefresh" intervalMs={60000}/>
            <a className={`rounded border px-3 py-1 text-xs ${exact
            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
            : "border-white/15 bg-white/5 text-slate-100 hover:border-white/25"}`} href={`/admin/catalog?${buildQueryString({ ...baseQuery, exact: exact ? undefined : "true" })}`} title={exact ? "Switch to quick counts" : "Switch to exact counts"}>
              {exact ? "Exact counts" : "Use exact counts"}
            </a>
            {/* Client-side refresh button to warm cache and refresh UI */}
            <CountsRefreshButton_1.default shopId={shopId} exact={exact}/>
            {nextToken ? (<a className="rounded border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-100 hover:border-white/25" href={`/admin/catalog?${buildQueryString({ ...baseQuery, token: nextToken })}`}>
                Next →
              </a>) : null}
          </div>
        </div>
        {shopId.toUpperCase() === "ALL" ? (<div className="text-sm text-slate-400">
            Select a shop to view its product list. Aggregated products across all shops are skipped to keep the page fast.
          </div>) : normalizedProducts.length === 0 ? (<p className="text-sm text-slate-400">No products match the current filters.</p>) : (<div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">QC Status</th>
                  <th className="px-4 py-3">Listing Status</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Sale Price</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {normalizedProducts.map((product) => (<tr key={product.key} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{product.name}</div>
                      <div className="text-xs text-slate-400">{product.sellerSku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${badgeClasses("qc", product.qcStatusKey)}`}>
                        {formatLabel(product.qcStatusKey || "unknown")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${badgeClasses("listing", product.statusKey)}`}>
                        {formatLabel(product.statusKey || "unknown")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-100">{formatCurrency(product.priceValue, product.currency)}</td>
                    <td className="px-4 py-3 text-emerald-100">{formatCurrency(product.salePriceValue, product.currency)}</td>
                    <td className="px-4 py-3 text-slate-100">{product.quantity !== undefined ? formatNumber(product.quantity) : "-"}</td>
                    <td className="px-4 py-3 text-slate-100">{product.shopName}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(product.updatedAt)}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </section>
    </div>);
}
