import type { ShopProduct } from "@/app/shop/shopData";
import { prisma } from "@/lib/prisma";

export type ProductPopularitySignal = {
  score: number;
  latestAt: number;
};

function normalizeProductKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getPopularitySignalsForProducts(products: ShopProduct[]) {
  const byOpsProductId = new Map<string, ProductPopularitySignal>();
  const byName = new Map<string, ProductPopularitySignal>();
  const opsProductIds = Array.from(
    new Set(
      products
        .map((product) => String(product.opsProductId || "").trim())
        .filter(Boolean),
    ),
  );

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
  return right.latestAt - left.latestAt || right.score - left.score || a.name.localeCompare(b.name);
}
