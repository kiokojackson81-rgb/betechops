import { getRedis, isRedisAvailable } from '@/lib/redis';

export type CrossShopKpis = {
  productsAll: number;
  pendingAll: number;
  approx?: boolean;
  updatedAt: number; // epoch ms
};

const KEY = 'kpis:cross-shops';
const TTL_SECONDS = 120;

let mem: CrossShopKpis | null = null;

export async function readKpisCache(): Promise<CrossShopKpis | null> {
  try {
    if (mem && Date.now() - mem.updatedAt < TTL_SECONDS * 1000) return mem;
    const r = await getRedis();
    if (!r) return mem;
    const raw = await r.get(KEY);
    if (!raw) return mem;
    const parsed = JSON.parse(raw) as CrossShopKpis;
    mem = parsed;
    return parsed;
  } catch {
    return mem;
  }
}

export async function writeKpisCache(value: CrossShopKpis): Promise<void> {
  mem = value;
  try {
    const r = await getRedis();
    if (!r) return;
    // best-effort: ioredis set signature supports EX seconds when passed as object or args
    // we use the most permissive unknown[] typing in our helper, so call as variadic
    await r.set(KEY, JSON.stringify(value), 'EX', TTL_SECONDS as unknown as number);
  } catch {
    // ignore failures; memory fallback remains
  }
}

export function isKpisCacheWarm(): boolean {
  return Boolean(mem && Date.now() - mem.updatedAt < TTL_SECONDS * 1000) || isRedisAvailable();
}
