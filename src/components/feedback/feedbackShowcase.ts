import type { ShopProduct } from "@/app/shop/shopData";
import { getShopProducts } from "@/app/shop/shopApi";
import { compareProductsByPopularity, getPopularitySignalsForProducts, type ProductPopularitySignal } from "@/lib/productPopularity";

function sortProductsForFeedback(products: ShopProduct[], popularitySignals: Map<string, ProductPopularitySignal>) {
  return [...products].sort((a, b) => compareProductsByPopularity(a, b, popularitySignals));
}

export async function getFeedbackShowcaseProducts(limit = 8) {
  const products = await getShopProducts();
  if (!products.length) return [] as ShopProduct[];
  const popularitySignals = await getPopularitySignalsForProducts(products);
  return sortProductsForFeedback(products, popularitySignals).slice(0, limit);
}
