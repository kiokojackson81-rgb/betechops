import type { ShopProduct } from "@/app/shop/shopData";
import {
  getAgentCommissionValue,
  getAgentPotentialCommissionValue,
  productCommissionRequiresApproval,
} from "@/app/agents/agentCatalogueShared";
import { prisma } from "@/lib/prisma";
export {
  getAgentCommissionValue,
  getAgentPotentialCommissionValue,
  productCommissionRequiresApproval,
} from "@/app/agents/agentCatalogueShared";

export const AGENT_SORT_OPTIONS = [
  { value: "featured", label: "Most popular" },
  { value: "name", label: "Latest" },
  { value: "price-low", label: "Price low-high" },
  { value: "commission-high", label: "Highest commission" },
] as const;

export const AGENT_PRICE_OPTIONS = [
  { value: "under-10000", label: "Under Ksh 10,000" },
  { value: "10000-50000", label: "Ksh 10,000 - 50,000" },
  { value: "50000-150000", label: "Ksh 50,000 - 150,000" },
  { value: "above-150000", label: "Above Ksh 150,000" },
] as const;

export const AGENT_STOCK_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "limited_stock", label: "Limited stock" },
  { value: "quote_only", label: "Request quote" },
] as const;

export type AgentListingFilters = {
  category?: string;
  sub?: string;
  brand?: string;
  price?: string;
  stock?: string;
  warranty?: string;
  sort?: string;
};

export type AgentProductRankSignal = {
  score: number;
  latestAt: number;
};

function normalizeProductKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function filterByPrice(price: number, bucket?: string) {
  switch (bucket) {
    case "under-10000":
      return price < 10000;
    case "10000-50000":
      return price >= 10000 && price <= 50000;
    case "50000-150000":
      return price > 50000 && price <= 150000;
    case "above-150000":
      return price > 150000;
    default:
      return true;
  }
}

export async function getPopularityByProduct(products: ShopProduct[]) {
  const byOpsProductId = new Map<string, number>();
  const byName = new Map<string, number>();
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
        .groupBy({
          by: ["productId"],
          where: { productId: { in: opsProductIds } },
          _sum: { quantity: true },
        })
        .catch(() => []),
      prisma.websiteOrderItem
        .groupBy({
          by: ["productId"],
          where: { productId: { in: opsProductIds } },
          _sum: { quantity: true },
        })
        .catch(() => []),
    ]);

    for (const row of posOrderItems) {
      byOpsProductId.set(row.productId, Number(row._sum.quantity ?? 0));
    }

    for (const row of websiteOrderItems) {
      if (!row.productId) continue;
      byOpsProductId.set(row.productId, Number(byOpsProductId.get(row.productId) ?? 0) + Number(row._sum.quantity ?? 0));
    }
  }

  const agentSales = await prisma.agentSale
    .groupBy({
      by: ["productName"],
      _sum: { quantity: true },
    })
    .catch(() => [] as Array<{ productName: string; _sum: { quantity: number | null } }>);

  for (const row of agentSales) {
    const key = normalizeProductKey(String(row.productName || ""));
    if (!key) continue;
    byName.set(key, Number(byName.get(key) ?? 0) + Number(row._sum.quantity ?? 0));
  }

  return new Map(
    products.map((product) => {
      const opsScore = product.opsProductId ? Number(byOpsProductId.get(product.opsProductId) ?? 0) : 0;
      const nameScore = Number(byName.get(normalizeProductKey(product.name)) ?? 0);
      return [product.id, opsScore + nameScore];
    }),
  );
}

export async function getPopularitySignalsByProduct(products: ShopProduct[]) {
  const byOpsProductId = new Map<string, AgentProductRankSignal>();
  const byName = new Map<string, AgentProductRankSignal>();
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

export function sortAgentProducts(products: ShopProduct[], popularityByProduct: Map<string, number>, sort?: string) {
  const items = [...products];

  switch (sort) {
    case "price-low":
      return items.sort((a, b) => a.price - b.price);
    case "name":
      return items.sort((a, b) => a.name.localeCompare(b.name));
    case "commission-high":
      return items.sort((a, b) => {
        const commissionDelta = getAgentCommissionValue(b) - getAgentCommissionValue(a);
        if (commissionDelta !== 0) return commissionDelta;
        return (popularityByProduct.get(b.id) ?? 0) - (popularityByProduct.get(a.id) ?? 0);
      });
    default:
      return items.sort((a, b) => {
        const popularityDelta = Number(popularityByProduct.get(b.id) ?? 0) - Number(popularityByProduct.get(a.id) ?? 0);
        if (popularityDelta !== 0) return popularityDelta;
        const commissionDelta = getAgentCommissionValue(b) - getAgentCommissionValue(a);
        if (commissionDelta !== 0) return commissionDelta;
        const aDiscount = (a.oldPrice || a.price) - a.price;
        const bDiscount = (b.oldPrice || b.price) - b.price;
        return bDiscount - aDiscount || a.name.localeCompare(b.name);
      });
  }
}

export function sortAgentProductsBySignals(
  products: ShopProduct[],
  popularitySignals: Map<string, AgentProductRankSignal>,
  sort?: string,
) {
  const items = [...products];

  switch (sort) {
    case "price-low":
      return items.sort((a, b) => a.price - b.price);
    case "name":
      return items.sort((a, b) => {
        const left = popularitySignals.get(a.id) ?? { score: 0, latestAt: 0 };
        const right = popularitySignals.get(b.id) ?? { score: 0, latestAt: 0 };
        return right.latestAt - left.latestAt || a.name.localeCompare(b.name);
      });
    case "commission-high":
      return items.sort((a, b) => {
        const commissionDelta = getAgentCommissionValue(b) - getAgentCommissionValue(a);
        if (commissionDelta !== 0) return commissionDelta;
        const left = popularitySignals.get(a.id) ?? { score: 0, latestAt: 0 };
        const right = popularitySignals.get(b.id) ?? { score: 0, latestAt: 0 };
        return right.score - left.score || right.latestAt - left.latestAt;
      });
    default:
      return items.sort((a, b) => {
        const left = popularitySignals.get(a.id) ?? { score: 0, latestAt: 0 };
        const right = popularitySignals.get(b.id) ?? { score: 0, latestAt: 0 };
        return (
          right.score - left.score ||
          right.latestAt - left.latestAt ||
          getAgentCommissionValue(b) - getAgentCommissionValue(a) ||
          ((b.oldPrice || b.price) - b.price) - ((a.oldPrice || a.price) - a.price) ||
          a.name.localeCompare(b.name)
        );
      });
  }
}

export function getBrandOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function getWarrantyOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.warranty).filter(Boolean))).slice(0, 8);
}
