import { getRedis, isRedisAvailable } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

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
    // Prefer DB persistent cache so serverless instances share values
    try {
      if (process.env.NODE_ENV !== 'test') {
        const row = await prisma.config.findUnique({ where: { key: KEY } });
        if (row?.json) {
          const parsed = row.json as unknown as CrossShopKpis;
          if (parsed?.updatedAt && Date.now() - Number(parsed.updatedAt) < TTL_SECONDS * 1000) {
            mem = parsed;
            return parsed;
          }
        }
      }
    } catch {}
    // Fallback to Redis (if available)
    const r = await getRedis();
    if (r) {
      const raw = await r.get(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CrossShopKpis;
        mem = parsed;
        return parsed;
      }
    }
    return mem;
  } catch {
    return mem;
  }
}

export async function writeKpisCache(value: CrossShopKpis): Promise<void> {
  mem = value;
  try {
    // Persist in DB for cross-instance availability (skip in unit tests)
    if (process.env.NODE_ENV !== 'test') {
      await prisma.config.upsert({
        where: { key: KEY },
        update: { json: value },
        create: { key: KEY, json: value },
      });
    }
  } catch {}
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
