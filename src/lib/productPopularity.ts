import { unstable_cache } from "next/cache";
import type { ShopProduct } from "@/app/shop/shopData";
import { prisma } from "@/lib/prisma";

export type ProductPopularitySignal = {
  score: number;
  latestAt: number;
};

const PRODUCT_POPULARITY_REVALIDATE_SECONDS = 600;

function getIsoTimestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNewestProductTimestamp(product: ShopProduct, signals: Map<string, ProductPopularitySignal>) {
  const signal = signals.get(product.id) ?? { score: 0, latestAt: 0 };
  return Math.max(
    getIsoTimestamp(product.updatedAt),
    getIsoTimestamp(product.createdAt),
    Number(signal.latestAt ?? 0),
  );
}

function normalizeProductKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getPopularitySignalsForProducts(products: ShopProduct[]) {
  const opsProductIds = Array.from(
    new Set(
      products
        .map((product) => String(product.opsProductId || "").trim())
        .filter(Boolean),
    ),
  );
  const normalizedNames = Array.from(
    new Set(
      products
        .map((product) => normalizeProductKey(product.name))
        .filter(Boolean),
    ),
  );
  const popularitySources = await getCachedPopularitySources(opsProductIds, normalizedNames);
  const byOpsProductId = new Map<string, ProductPopularitySignal>();
  const byName = new Map<string, ProductPopularitySignal>();
  for (const [productId, signal] of popularitySources.byOpsProductId) {
    byOpsProductId.set(productId, signal);
  }
  for (const [productName, signal] of popularitySources.byName) {
    byName.set(productName, signal);
  }

  return new Map(
    products.map((product) => {
      const opsSignal = product.opsProductId ? byOpsProductId.get(product.opsProductId) : null;
      const nameSignal = byName.get(normalizeProductKey(product.name)) ?? null;
      return [
        product.id,
        {
          score: Number(opsSignal?.score ?? 0) + Number(nameSignal?.score ?? 0),
          latestAt: Math.max(Number(opsSignal?.latestAt ?? 0), Number(nameSignal?.latestAt ?? 0)),
        },
      ] as const;
    }),
  );
}

const getCachedPopularitySources = unstable_cache(
  async (opsProductIds: string[], normalizedNames: string[]) => {
    const byOpsProductId = new Map<string, ProductPopularitySignal>();
    const byName = new Map<string, ProductPopularitySignal>();

    if (opsProductIds.length) {
      const [posOrderItems, websiteOrderItems] = await Promise.all([
        prisma.orderItem
          .findMany({
            where: { productId: { in: opsProductIds } },
            select: {
              productId: true,
              quantity: true,
              order: { select: { createdAt: true } },
            },
          })
          .catch(() => []),
        prisma.websiteOrderItem
          .findMany({
            where: { productId: { in: opsProductIds } },
            select: {
              productId: true,
              quantity: true,
              websiteOrder: { select: { createdAt: true } },
            },
          })
          .catch(() => []),
      ]);

      for (const row of posOrderItems) {
        const existing = byOpsProductId.get(row.productId) ?? { score: 0, latestAt: 0 };
        byOpsProductId.set(row.productId, {
          score: existing.score + Number(row.quantity ?? 0),
          latestAt: Math.max(existing.latestAt, new Date(row.order.createdAt).getTime()),
        });
      }

      for (const row of websiteOrderItems) {
        if (!row.productId) continue;
        const existing = byOpsProductId.get(row.productId) ?? { score: 0, latestAt: 0 };
        byOpsProductId.set(row.productId, {
          score: existing.score + Number(row.quantity ?? 0),
          latestAt: Math.max(existing.latestAt, new Date(row.websiteOrder.createdAt).getTime()),
        });
      }
    }

    if (normalizedNames.length) {
      const agentSales = await prisma.agentSale
        .findMany({
          select: {
            productName: true,
            quantity: true,
            createdAt: true,
          },
        })
        .catch(() => [] as Array<{ productName: string; quantity: number; createdAt: Date }>);

      for (const row of agentSales) {
        const key = normalizeProductKey(String(row.productName || ""));
        if (!key) continue;
        const existing = byName.get(key) ?? { score: 0, latestAt: 0 };
        byName.set(key, {
          score: existing.score + Number(row.quantity ?? 0),
          latestAt: Math.max(existing.latestAt, new Date(row.createdAt).getTime()),
        });
      }
    }

    return {
      byOpsProductId: Array.from(byOpsProductId.entries()),
      byName: Array.from(byName.entries()),
    };
  },
  ["shop:product-popularity:v1"],
  {
    revalidate: PRODUCT_POPULARITY_REVALIDATE_SECONDS,
  },
);

export function getPopularityCountsFromSignals(signals: Map<string, ProductPopularitySignal>) {
  return new Map(Array.from(signals.entries(), ([productId, signal]) => [productId, Number(signal.score ?? 0)]));
}

export function compareProductsByPopularity(
  a: ShopProduct,
  b: ShopProduct,
  signals: Map<string, ProductPopularitySignal>,
) {
  const left = signals.get(a.id) ?? { score: 0, latestAt: 0 };
  const right = signals.get(b.id) ?? { score: 0, latestAt: 0 };
  const aDiscount = (a.oldPrice || a.price) - a.price;
  const bDiscount = (b.oldPrice || b.price) - b.price;

  return (
    right.latestAt - left.latestAt ||
    right.score - left.score ||
    bDiscount - aDiscount ||
    b.price - a.price ||
    a.name.localeCompare(b.name)
  );
}

export function compareProductsByLatest(
  a: ShopProduct,
  b: ShopProduct,
  signals: Map<string, ProductPopularitySignal>,
) {
  const left = signals.get(a.id) ?? { score: 0, latestAt: 0 };
  const right = signals.get(b.id) ?? { score: 0, latestAt: 0 };
  return (
    getNewestProductTimestamp(b, signals) - getNewestProductTimestamp(a, signals) ||
    right.score - left.score ||
    b.price - a.price ||
    a.name.localeCompare(b.name)
  );
}
