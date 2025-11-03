import { prisma } from "./prisma";
import {
  getCatalogProductsCountExactForShop,
  getCatalogProductsCountExactAll,
} from "./jumia";

export type Summary = {
  total: number;
  approx: boolean;
  byStatus: Record<string, number>;
  byQcStatus: Record<string, number>;
};

// In unit tests, avoid real DB reads/writes to keep tests fast and hermetic.
const __TEST_MODE__ = process.env.NODE_ENV === 'test';
const __memAgg__: { row: any | null } = { row: null };

function normalizeKey(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

function canonicalize(key: string): string {
  return normalizeKey(key).replace(/[\s-]+/g, "_");
}

function normalizeMap(source: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(source || {})) {
    const ck = canonicalize(k);
    out[ck] = (out[ck] || 0) + Number(v || 0);
  }
  return out;
}

// Aliases aligned with UI components
const listingStatusAliases: Record<string, string[]> = {
  active: ["active", "enabled", "live"],
  inactive: ["inactive", "disabled", "off", "blocked", "not_live", "not live"],
  deleted: ["deleted", "removed"],
  pending: ["pending", "waiting_activation", "pending_activation", "activation_pending", "processing", "pending activation"],
};
const qcStatusAliases: Record<string, string[]> = {
  approved: ["approved", "qc_approved"],
  pending: ["pending", "qc_pending"],
  not_ready_to_qc: ["not_ready_to_qc", "not ready to qc", "not-ready-to-qc", "draft", "incomplete"],
  rejected: ["rejected", "qc_rejected"],
};

function bucketSum(source: Record<string, number>, keys: string[]): number {
  const normalized = normalizeMap(source);
  let sum = 0;
  for (const key of keys) {
    const variants = new Set<string>([canonicalize(key), normalizeKey(key)]);
    for (const variant of variants) sum += Number((normalized as any)?.[variant] || 0);
  }
  return sum;
}

function deriveExpanded(summary: Summary) {
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

export async function computeAndStoreCountersForShop(shopId: string, opts?: { size?: number; timeMs?: number }) {
  if (!shopId) throw new Error("shopId required");
  const exact = await getCatalogProductsCountExactForShop({ shopId, size: Math.min(100, Math.max(50, opts?.size || 100)), timeMs: Math.max(30_000, opts?.timeMs || 60_000) });
  const exp = deriveExpanded(exact);
  const now = new Date();
  const row = await prisma.catalogCounters.upsert({
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
      byStatus: exp.byStatus as any,
      byQcStatus: exp.byQcStatus as any,
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
      byStatus: exp.byStatus as any,
      byQcStatus: exp.byQcStatus as any,
      computedAt: now,
    },
  });
  return row;
}

export async function recomputeAllCounters() {
  const shops = await prisma.shop.findMany({ where: { isActive: true, platform: "JUMIA" }, select: { id: true } });
  const perShop = [] as Awaited<ReturnType<typeof computeAndStoreCountersForShop>>[];
  for (const s of shops) {
    try {
      const r = await computeAndStoreCountersForShop(s.id);
      perShop.push(r);
    } catch {
      // continue
    }
  }
  // Aggregate using vendor exact-all when possible for better accuracy/latency
  let agg: Summary | null = null;
  try {
  agg = await getCatalogProductsCountExactAll({ size: 100, timeMs: 60_000 });
  } catch {
    agg = null;
  }
  if (!agg) {
    // Fallback: sum per-shop rows we just computed
    const sum = perShop.reduce(
      (acc, r) => {
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
      },
      {
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
      },
    ) as any;
    const row = await prisma.catalogCounters.upsert({
      where: { scope_shopId: { scope: "ALL", shopId: "ALL" } },
      update: { ...sum, computedAt: new Date() },
      create: { scope: "ALL", shopId: "ALL", ...sum, computedAt: new Date() },
    });
    return { perShop, aggregate: row };
  }
  const exp = deriveExpanded(agg);
  const row = await prisma.catalogCounters.upsert({
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
      byStatus: exp.byStatus as any,
      byQcStatus: exp.byQcStatus as any,
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
      byStatus: exp.byStatus as any,
      byQcStatus: exp.byQcStatus as any,
      computedAt: new Date(),
    },
  });
  return { perShop, aggregate: row };
}

export async function getLatestCounters(opts: { scope: "ALL" } | { scope: "SHOP"; shopId: string }, stalenessMs = 30 * 60_000) {
  if (__TEST_MODE__) {
    // Present as stale to force route handlers to compute fresh values without DB requirement
    return { stale: true, row: null } as const;
  }
  const where = (opts.scope === "ALL"
    ? { scope: "ALL", shopId: "ALL" }
    : { scope: "SHOP", shopId: (opts as any).shopId }) as any;
  const row = await prisma.catalogCounters.findUnique({ where: { scope_shopId: where } });
  if (!row) return { stale: true, row: null } as const;
  const ts = new Date(row.computedAt).getTime();
  const stale = Date.now() - ts > stalenessMs;
  return { stale, row } as const;
}

export function rowToSummaryPayload(row: any): Summary {
  // Prefer granular maps when present; otherwise reconstruct from expanded fields
  const byStatus: Record<string, number> = row?.byStatus || {};
  const byQcStatus: Record<string, number> = row?.byQcStatus || {};
  return {
    total: Number(row?.total || 0),
    approx: !!row?.approx,
    byStatus,
    byQcStatus,
  };
}

export async function storeAggregateSummary(summary: Summary) {
  if (__TEST_MODE__) {
    const exp = deriveExpanded(summary);
    const row = {
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
      byStatus: exp.byStatus as any,
      byQcStatus: exp.byQcStatus as any,
      computedAt: new Date(),
    };
    __memAgg__.row = row;
    return row;
  }
  const exp = deriveExpanded(summary);
  const row = await prisma.catalogCounters.upsert({
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
      byStatus: exp.byStatus as any,
      byQcStatus: exp.byQcStatus as any,
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
      byStatus: exp.byStatus as any,
      byQcStatus: exp.byQcStatus as any,
      computedAt: new Date(),
    },
  });
  return row;
}
