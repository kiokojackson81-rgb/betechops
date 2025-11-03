"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAndStoreCountersForShop = computeAndStoreCountersForShop;
exports.recomputeAllCounters = recomputeAllCounters;
exports.getLatestCounters = getLatestCounters;
exports.rowToSummaryPayload = rowToSummaryPayload;
exports.storeAggregateSummary = storeAggregateSummary;
const prisma_1 = require("./prisma");
const jumia_1 = require("./jumia");
function normalizeKey(value) {
    if (value === undefined || value === null)
        return "";
    return String(value).trim().toLowerCase();
}
function canonicalize(key) {
    return normalizeKey(key).replace(/[\s-]+/g, "_");
}
function normalizeMap(source) {
    const out = {};
    for (const [k, v] of Object.entries(source || {})) {
        const ck = canonicalize(k);
        out[ck] = (out[ck] || 0) + Number(v || 0);
    }
    return out;
}
// Aliases aligned with UI components
const listingStatusAliases = {
    active: ["active", "enabled", "live"],
    inactive: ["inactive", "disabled", "off", "blocked", "not_live", "not live"],
    deleted: ["deleted", "removed"],
    pending: ["pending", "waiting_activation", "pending_activation", "activation_pending", "processing", "pending activation"],
};
const qcStatusAliases = {
    approved: ["approved", "qc_approved"],
    pending: ["pending", "qc_pending"],
    not_ready_to_qc: ["not_ready_to_qc", "not ready to qc", "not-ready-to-qc", "draft", "incomplete"],
    rejected: ["rejected", "qc_rejected"],
};
function bucketSum(source, keys) {
    const normalized = normalizeMap(source);
    let sum = 0;
    for (const key of keys) {
        const variants = new Set([canonicalize(key), normalizeKey(key)]);
        for (const variant of variants)
            sum += Number((normalized === null || normalized === void 0 ? void 0 : normalized[variant]) || 0);
    }
    return sum;
}
function deriveExpanded(summary) {
    const byStatus = normalizeMap(summary.byStatus);
    const byQc = normalizeMap(summary.byQcStatus);
    const active = bucketSum(byStatus, listingStatusAliases.active);
    const inactive = bucketSum(byStatus, listingStatusAliases.inactive);
    const deleted = bucketSum(byStatus, listingStatusAliases.deleted);
    const pending = bucketSum(byStatus, listingStatusAliases.pending);
    const visibleLive = active; // heuristic: treat active/live as visible
    const qcApproved = bucketSum(byQc, qcStatusAliases.approved);
    const qcPending = bucketSum(byQc, qcStatusAliases.pending);
    const qcRejected = bucketSum(byQc, qcStatusAliases.rejected);
    const qcNotReady = bucketSum(byQc, qcStatusAliases.not_ready_to_qc);
    return {
        total: Number(summary.total || 0),
        approx: !!summary.approx,
        byStatus,
        byQcStatus: byQc,
        active,
        inactive,
        deleted,
        pending,
        visibleLive,
        qcApproved,
        qcPending,
        qcRejected,
        qcNotReady,
    };
}
async function computeAndStoreCountersForShop(shopId, opts) {
    if (!shopId)
        throw new Error("shopId required");
    const exact = await (0, jumia_1.getCatalogProductsCountExactForShop)({ shopId, size: Math.min(100, Math.max(50, (opts === null || opts === void 0 ? void 0 : opts.size) || 100)), timeMs: Math.max(30000, (opts === null || opts === void 0 ? void 0 : opts.timeMs) || 60000) });
    const exp = deriveExpanded(exact);
    const now = new Date();
    const row = await prisma_1.prisma.catalogCounters.upsert({
        where: { scope_shopId: { scope: "SHOP", shopId } },
        update: {
            total: exp.total,
            active: exp.active,
            inactive: exp.inactive,
            deleted: exp.deleted,
            pending: exp.pending,
            visibleLive: exp.visibleLive,
            qcApproved: exp.qcApproved,
            qcPending: exp.qcPending,
            qcRejected: exp.qcRejected,
            qcNotReady: exp.qcNotReady,
            approx: exp.approx,
            byStatus: exp.byStatus,
            byQcStatus: exp.byQcStatus,
            computedAt: now,
        },
        create: {
            scope: "SHOP",
            shopId,
            total: exp.total,
            active: exp.active,
            inactive: exp.inactive,
            deleted: exp.deleted,
            pending: exp.pending,
            visibleLive: exp.visibleLive,
            qcApproved: exp.qcApproved,
            qcPending: exp.qcPending,
            qcRejected: exp.qcRejected,
            qcNotReady: exp.qcNotReady,
            approx: exp.approx,
            byStatus: exp.byStatus,
            byQcStatus: exp.byQcStatus,
            computedAt: now,
        },
    });
    return row;
}
async function recomputeAllCounters() {
    const shops = await prisma_1.prisma.shop.findMany({ where: { isActive: true, platform: "JUMIA" }, select: { id: true } });
    const perShop = [];
    for (const s of shops) {
        try {
            const r = await computeAndStoreCountersForShop(s.id);
            perShop.push(r);
        }
        catch (_a) {
            // continue
        }
    }
    // Aggregate using vendor exact-all when possible for better accuracy/latency
    let agg = null;
    try {
        agg = await (0, jumia_1.getCatalogProductsCountExactAll)({ size: 100, timeMs: 60000 });
    }
    catch (_b) {
        agg = null;
    }
    if (!agg) {
        // Fallback: sum per-shop rows we just computed
        const sum = perShop.reduce((acc, r) => {
            acc.total += r.total;
            acc.active += r.active;
            acc.inactive += r.inactive;
            acc.deleted += r.deleted;
            acc.pending += r.pending;
            acc.visibleLive += r.visibleLive;
            acc.qcApproved += r.qcApproved;
            acc.qcPending += r.qcPending;
            acc.qcRejected += r.qcRejected;
            acc.qcNotReady += r.qcNotReady;
            // approx becomes true if any are approx
            acc.approx = acc.approx || r.approx;
            return acc;
        }, {
            total: 0,
            active: 0,
            inactive: 0,
            deleted: 0,
            pending: 0,
            visibleLive: 0,
            qcApproved: 0,
            qcPending: 0,
            qcRejected: 0,
            qcNotReady: 0,
            approx: false,
        });
        const row = await prisma_1.prisma.catalogCounters.upsert({
            where: { scope_shopId: { scope: "ALL", shopId: "ALL" } },
            update: Object.assign(Object.assign({}, sum), { computedAt: new Date() }),
            create: Object.assign(Object.assign({ scope: "ALL", shopId: "ALL" }, sum), { computedAt: new Date() }),
        });
        return { perShop, aggregate: row };
    }
    const exp = deriveExpanded(agg);
    const row = await prisma_1.prisma.catalogCounters.upsert({
        where: { scope_shopId: { scope: "ALL", shopId: "ALL" } },
        update: {
            total: exp.total,
            active: exp.active,
            inactive: exp.inactive,
            deleted: exp.deleted,
            pending: exp.pending,
            visibleLive: exp.visibleLive,
            qcApproved: exp.qcApproved,
            qcPending: exp.qcPending,
            qcRejected: exp.qcRejected,
            qcNotReady: exp.qcNotReady,
            approx: exp.approx,
            byStatus: exp.byStatus,
            byQcStatus: exp.byQcStatus,
            computedAt: new Date(),
        },
        create: {
            scope: "ALL",
            shopId: "ALL",
            total: exp.total,
            active: exp.active,
            inactive: exp.inactive,
            deleted: exp.deleted,
            pending: exp.pending,
            visibleLive: exp.visibleLive,
            qcApproved: exp.qcApproved,
            qcPending: exp.qcPending,
            qcRejected: exp.qcRejected,
            qcNotReady: exp.qcNotReady,
            approx: exp.approx,
            byStatus: exp.byStatus,
            byQcStatus: exp.byQcStatus,
            computedAt: new Date(),
        },
    });
    return { perShop, aggregate: row };
}
async function getLatestCounters(opts, stalenessMs = 30 * 60000) {
    const where = (opts.scope === "ALL"
        ? { scope: "ALL", shopId: "ALL" }
        : { scope: "SHOP", shopId: opts.shopId });
    const row = await prisma_1.prisma.catalogCounters.findUnique({ where: { scope_shopId: where } });
    if (!row)
        return { stale: true, row: null };
    const ts = new Date(row.computedAt).getTime();
    const stale = Date.now() - ts > stalenessMs;
    return { stale, row };
}
function rowToSummaryPayload(row) {
    // Prefer granular maps when present; otherwise reconstruct from expanded fields
    const byStatus = (row === null || row === void 0 ? void 0 : row.byStatus) || {};
    const byQcStatus = (row === null || row === void 0 ? void 0 : row.byQcStatus) || {};
    return {
        total: Number((row === null || row === void 0 ? void 0 : row.total) || 0),
        approx: !!(row === null || row === void 0 ? void 0 : row.approx),
        byStatus,
        byQcStatus,
    };
}
async function storeAggregateSummary(summary) {
    const exp = deriveExpanded(summary);
    const row = await prisma_1.prisma.catalogCounters.upsert({
        where: { scope_shopId: { scope: "ALL", shopId: "ALL" } },
        update: {
            total: exp.total,
            active: exp.active,
            inactive: exp.inactive,
            deleted: exp.deleted,
            pending: exp.pending,
            visibleLive: exp.visibleLive,
            qcApproved: exp.qcApproved,
            qcPending: exp.qcPending,
            qcRejected: exp.qcRejected,
            qcNotReady: exp.qcNotReady,
            approx: exp.approx,
            byStatus: exp.byStatus,
            byQcStatus: exp.byQcStatus,
            computedAt: new Date(),
        },
        create: {
            scope: "ALL",
            shopId: "ALL",
            total: exp.total,
            active: exp.active,
            inactive: exp.inactive,
            deleted: exp.deleted,
            pending: exp.pending,
            visibleLive: exp.visibleLive,
            qcApproved: exp.qcApproved,
            qcPending: exp.qcPending,
            qcRejected: exp.qcRejected,
            qcNotReady: exp.qcNotReady,
            approx: exp.approx,
            byStatus: exp.byStatus,
            byQcStatus: exp.byQcStatus,
            computedAt: new Date(),
        },
    });
    return row;
}
