import { prisma } from "@/lib/prisma";
import { getOrders } from "@/lib/jumia";

export type HealthPayload = {
  status: "ok";
  productCount: number;
  authReady: boolean;
  dbOk: boolean;
  hasDatabaseUrl: boolean;
  dbScheme: string | null;
  dbHost: string | null;
  timestamp: string;
};

export async function computeHealth(): Promise<HealthPayload> {
  let productCount = 0;
  let dbOk = false;
  try {
    productCount = await prisma.product.count();
    dbOk = true;
  } catch (e) {
    console.error("computeHealth prisma error:", e);
  }

  const authReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);

  const dbUrl = process.env.DATABASE_URL || "";
  let dbScheme: string | null = null;
  let dbHost: string | null = null;
  try {
    if (dbUrl) {
      const u = new URL(dbUrl.replace(/^postgres:\/\//, "postgresql://"));
      dbScheme = u.protocol.replace(":", "");
      dbHost = u.hostname;
    }
  } catch {
    // ignore parse errors
  }

  return {
    status: "ok",
    productCount,
    authReady,
    dbOk,
    hasDatabaseUrl: Boolean(dbUrl),
    dbScheme,
    dbHost,
    timestamp: new Date().toISOString(),
  };
}

export type ShopConnectivity = {
  id: string;
  name: string;
  platform: string;
  isActive: boolean;
  ping: { ok: boolean; status?: number; count?: number; error?: string };
  lastActivity: {
    order?: string | null;
    fulfillment?: string | null;
    settlement?: string | null;
    returns?: string | null;
  };
  lastSeenAt: string | null;
};

export async function computeShopsConnectivity(): Promise<ShopConnectivity[]> {
  let shops: Array<{ id: string; name: string; platform: string; isActive: boolean }> = [];
  try {
    shops = await prisma.shop.findMany({ select: { id: true, name: true, platform: true, isActive: true }, orderBy: { name: 'asc' } });
  } catch (e) {
    // During DB outages or quota limits, degrade gracefully: no shops listed
    console.error('computeShopsConnectivity prisma error:', e);
    return [];
  }

  const today = new Date();
  const yyyy = today.toISOString().slice(0, 10);

  const out: ShopConnectivity[] = [];
  for (const s of shops) {
    // Ping: JUMIA via getOrders; KILIMALL pending until official API
    let ping: ShopConnectivity['ping'] = { ok: false };
    if (s.platform === 'JUMIA') {
      try {
        const j = await getOrders({ size: 1, createdAfter: yyyy, createdBefore: yyyy, shopId: s.id });
        const arr = Array.isArray((j as any)?.orders)
          ? (j as any).orders
          : Array.isArray((j as any)?.items)
          ? (j as any).items
          : Array.isArray((j as any)?.data)
          ? (j as any).data
          : [];
        ping = { ok: true, status: 200, count: arr.length };
      } catch (e) {
        const status = (e as any)?.status ?? 0;
        const msg = (e instanceof Error ? e.message : String(e)) || 'error';
        ping = { ok: false, status, error: msg };
      }
    } else if (s.platform === 'KILIMALL') {
      ping = { ok: false, status: 0, error: 'pending integration' };
    } else {
      ping = { ok: false, status: 0, error: 'unknown platform' };
    }

    // Last activity timestamps (proxy for last sync)
    const [o, f, stl, ret] = await Promise.all([
      prisma.order.findFirst({ where: { shopId: s.id }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }).catch(() => null),
      prisma.fulfillmentAudit.findFirst({ where: { shopId: s.id }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }).catch(() => null),
      prisma.settlementRow.findFirst({ where: { shopId: s.id }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }).catch(() => null),
      prisma.returnCase.findFirst({ where: { shopId: s.id }, select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }).catch(() => null),
    ]);
    const lastOrder = o?.createdAt ? o.createdAt.toISOString() : null;
    const lastFulfill = f?.createdAt ? f.createdAt.toISOString() : null;
    const lastSettlement = stl?.createdAt ? stl.createdAt.toISOString() : null;
    const lastReturn = ret?.updatedAt ? ret.updatedAt.toISOString() : null;
    const maxTs = [lastOrder, lastFulfill, lastSettlement, lastReturn]
      .filter(Boolean)
      .map((t) => new Date(t as string).getTime());
    const lastSeenAt = maxTs.length ? new Date(Math.max(...maxTs)).toISOString() : null;

    out.push({
      id: s.id,
      name: s.name,
      platform: s.platform,
      isActive: s.isActive,
      ping,
      lastActivity: { order: lastOrder, fulfillment: lastFulfill, settlement: lastSettlement, returns: lastReturn },
      lastSeenAt,
    });
  }

  return out;
}
