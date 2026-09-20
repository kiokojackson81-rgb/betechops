"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShopProduct } from "@/app/shop/shopData";

type CatalogueResponse = { products?: ShopProduct[] };

let cachedProducts: ShopProduct[] | null = null;
let productsRequest: Promise<ShopProduct[]> | null = null;

function loadProducts() {
  if (cachedProducts) return Promise.resolve(cachedProducts);
  if (productsRequest) return productsRequest;

  productsRequest = fetch("/api/shop/products", { cache: "default" })
    .then(async (response) => {
      const payload = await response.json().catch(() => null) as CatalogueResponse | null;
      if (!response.ok || !Array.isArray(payload?.products)) {
        throw new Error("The product catalogue is temporarily unavailable.");
      }
      cachedProducts = payload.products;
      return cachedProducts;
    })
    .finally(() => {
      productsRequest = null;
    });

  return productsRequest;
}

/** Starts the cached catalogue request without holding up navigation. */
export function preloadShopProducts() {
  void loadProducts().catch(() => undefined);
}

export function useShopProducts() {
  const [products, setProducts] = useState<ShopProduct[]>(() => cachedProducts || []);
  const [loading, setLoading] = useState(() => !cachedProducts);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (cachedProducts) {
      setProducts(cachedProducts);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    loadProducts()
      .then(setProducts)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the product catalogue.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = useCallback(() => {
    cachedProducts = null;
    productsRequest = null;
    load();
  }, [load]);

  return { products, loading, error, retry };
}
