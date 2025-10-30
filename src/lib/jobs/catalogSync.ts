import { prisma } from "@/lib/prisma";
import { getShops, getCatalogProducts } from "@/lib/jumia";

/**
 * Iterate all shops and snapshot catalog totals.
 * Writes to Config as key `catalog:shop:${shopId}:latest` to avoid schema changes.
 */
export async function syncAllCatalogs() {
  const shops = await getShops();
  const nowIso = new Date().toISOString();
  for (const s of (Array.isArray(shops) ? shops : [])) {
    const shopId = String((s as any)?.id || (s as any)?.shopId || "");
    if (!shopId) continue;
    try {
      const res: any = await getCatalogProducts({ size: 200, shopId });
      const total = Number(res?.total ?? res?.totalCount ?? res?.totalElements ?? (Array.isArray(res?.products) ? res.products.length : 0));
      const key = `catalog:shop:${shopId}:latest`;
      const json = { shopId, total, lastSynced: nowIso } as const;
      await prisma.config.upsert({
        where: { key },
        update: { json },
        create: { key, json },
      });
    } catch (e) {
      // best-effort; continue
      await prisma.config.upsert({
        where: { key: `catalog:shop:${shopId}:latest` },
        update: { json: { shopId, total: 0, lastSynced: nowIso, error: (e as any)?.message || String(e) } },
        create: { key: `catalog:shop:${shopId}:latest`, json: { shopId, total: 0, lastSynced: nowIso, error: (e as any)?.message || String(e) } },
      });
    }
  }
}

export default { syncAllCatalogs };
