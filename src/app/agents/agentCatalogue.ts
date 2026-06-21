import type { ShopProduct } from "@/app/shop/shopData";
import {
  getAgentCommissionValue,
  getAgentPotentialCommissionValue,
  productCommissionRequiresApproval,
} from "@/app/agents/agentCatalogueShared";
import {
  compareProductsByLatest,
  compareProductsByPopularity,
  getPopularityCountsFromSignals,
  getPopularitySignalsForProducts,
  type ProductPopularitySignal,
} from "@/lib/productPopularity";
export {
  getAgentCommissionValue,
  getAgentPotentialCommissionValue,
  productCommissionRequiresApproval,
} from "@/app/agents/agentCatalogueShared";

export const AGENT_SORT_OPTIONS = [
  { value: "featured", label: "Most popular" },
  { value: "latest", label: "Latest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
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
  { value: "quote_only", label: "Quote required" },
] as const;

export type AgentListingFilters = {
  category?: string;
  sub?: string;
  brand?: string;
  price?: string;
  minPrice?: string;
  maxPrice?: string;
  stock?: string;
  warranty?: string;
  sort?: string;
};

export type AgentProductRankSignal = ProductPopularitySignal;

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

export function normalizePriceRange(minPrice?: string, maxPrice?: string) {
  const parsedMin = Number(minPrice);
  const parsedMax = Number(maxPrice);
  const hasMin = Number.isFinite(parsedMin) && parsedMin >= 0;
  const hasMax = Number.isFinite(parsedMax) && parsedMax >= 0;

  if (hasMin && hasMax && parsedMin === 0 && parsedMax === 0) {
    return {
      min: undefined,
      max: undefined,
    };
  }

  if (hasMin && hasMax) {
    return {
      min: Math.min(parsedMin, parsedMax),
      max: Math.max(parsedMin, parsedMax),
    };
  }

  return {
    min: hasMin ? parsedMin : undefined,
    max: hasMax ? parsedMax : undefined,
  };
}

export function filterByManualPrice(price: number, minPrice?: number, maxPrice?: number) {
  if (typeof minPrice === "number" && price < minPrice) return false;
  if (typeof maxPrice === "number" && price > maxPrice) return false;
  return true;
}

export async function getPopularityByProduct(products: ShopProduct[]) {
  const signals = await getPopularitySignalsForProducts(products);
  return getPopularityCountsFromSignals(signals);
}

export async function getPopularitySignalsByProduct(products: ShopProduct[]) {
  return getPopularitySignalsForProducts(products);
}

export function sortAgentProducts(products: ShopProduct[], popularityByProduct: Map<string, number>, sort?: string) {
  const items = [...products];
  const popularitySignals = new Map(
    products.map((product) => [
      product.id,
      {
        score: Number(popularityByProduct.get(product.id) ?? 0),
        latestAt: 0,
      },
    ]),
  );

  switch (sort) {
    case "price-low":
      return items.sort((a, b) => a.price - b.price);
    case "price-high":
      return items.sort((a, b) => b.price - a.price);
    case "latest":
    case "name":
      return items.sort((a, b) => compareProductsByLatest(a, b, popularitySignals));
    case "commission-high":
      return items.sort((a, b) => {
        const commissionDelta = getAgentCommissionValue(b) - getAgentCommissionValue(a);
        if (commissionDelta !== 0) return commissionDelta;
        return compareProductsByPopularity(a, b, popularitySignals);
      });
    default:
      return items.sort((a, b) => {
        const popularityDelta = compareProductsByPopularity(a, b, popularitySignals);
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
    case "price-high":
      return items.sort((a, b) => b.price - a.price);
    case "latest":
    case "name":
      return items.sort((a, b) => compareProductsByLatest(a, b, popularitySignals));
    case "commission-high":
      return items.sort((a, b) => {
        const commissionDelta = getAgentCommissionValue(b) - getAgentCommissionValue(a);
        if (commissionDelta !== 0) return commissionDelta;
        return compareProductsByPopularity(a, b, popularitySignals);
      });
    default:
      return items.sort((a, b) => {
        return compareProductsByPopularity(a, b, popularitySignals) || getAgentCommissionValue(b) - getAgentCommissionValue(a);
      });
  }
}

export function getBrandOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function getWarrantyOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.warranty).filter(Boolean))).slice(0, 8);
}
