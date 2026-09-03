import { allShopProducts, type ShopProduct } from "@/app/shop/shopData";
import {
  buildQuoteRequestDraft,
  isShopOpsApiEnabled,
} from "@/app/shop/integrationPlan";
import {
  filterShopProducts,
  getOpsCatalogueProductMappedById,
  getOpsCatalogueProductMappedBySlug,
  getOpsCatalogueProductsReadOnlyMapped,
} from "@/app/shop/shopProductMapper";

export type ShopOrderInput = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerLocation: string;
  deliveryMethod: string;
  paymentMethod: string;
  notes?: string;
};

export type QuoteRequestInput = {
  name: string;
  phone: string;
  location?: string;
  propertyType?: string;
  load?: string;
  budgetRange?: string;
  preferredProducts?: string;
  notes?: string;
};

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shop API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function getApiUrl(path: string) {
  if (typeof window !== "undefined") return path;
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}${path}`;
}

type ShopProductQuery = {
  category?: string;
  subcategory?: string;
  q?: string;
};

async function getServerShopProducts(input?: ShopProductQuery): Promise<ShopProduct[]> {
  if (!isShopOpsApiEnabled()) {
    return filterShopProducts(allShopProducts, input);
  }

  try {
    return filterShopProducts(await getOpsCatalogueProductsReadOnlyMapped(), input);
  } catch (error) {
    console.error("[shop] server-side product lookup failed in live ops mode", error);
    return [];
  }
}

export async function getShopProducts(input?: ShopProductQuery): Promise<ShopProduct[]> {
  if (typeof window === "undefined") {
    return getServerShopProducts(input);
  }

  const query = new URLSearchParams();
  if (input?.category) query.set("category", input.category);
  if (input?.subcategory) query.set("subcategory", input.subcategory);
  if (input?.q) query.set("q", input.q);

  const response = await fetchJson<{ products: ShopProduct[] }>(
    getApiUrl(`/api/shop/products${query.toString() ? `?${query.toString()}` : ""}`),
  ).catch(() => null);

  if (response && Array.isArray(response.products)) return response.products;

  return isShopOpsApiEnabled() ? [] : filterShopProducts(allShopProducts, input);
}

export async function getShopProductBySlug(slug: string): Promise<ShopProduct | null> {
  if (typeof window === "undefined") {
    const cachedProduct = (await getServerShopProducts()).find((product) => product.slug === slug) ?? null;
    if (cachedProduct || !isShopOpsApiEnabled()) return cachedProduct;
    return getOpsCatalogueProductMappedBySlug(slug);
  }

  const response = await fetchJson<{ product: ShopProduct | null }>(getApiUrl(`/api/shop/products/${slug}`)).catch(() => null);
  if (response) return response.product;

  return isShopOpsApiEnabled() ? null : allShopProducts.find((product) => product.slug === slug) ?? null;
}

export async function getShopProductBySlugOrOpsProductId(slug: string, opsProductId?: string | null): Promise<ShopProduct | null> {
  const normalizedOpsProductId = String(opsProductId || "").trim();

  if (typeof window === "undefined") {
    const products = await getServerShopProducts();
    if (normalizedOpsProductId) {
      const byOpsProductId = products.find((product) => product.opsProductId === normalizedOpsProductId) ?? null;
      if (byOpsProductId) return byOpsProductId;

      const fallbackByOpsProductId = await getOpsCatalogueProductMappedById(normalizedOpsProductId);
      if (fallbackByOpsProductId) return fallbackByOpsProductId;
    }

    const bySlug = products.find((product) => product.slug === slug) ?? null;
    if (bySlug) return bySlug;

    return null;
  }

  if (normalizedOpsProductId) {
    const response = await fetchJson<{ products: ShopProduct[] }>(getApiUrl(`/api/shop/products`)).catch(() => null);
    if (response?.products) {
      const byOpsProductId = response.products.find((product) => product.opsProductId === normalizedOpsProductId) ?? null;
      if (byOpsProductId) return byOpsProductId;
    }
  }

  return getShopProductBySlug(slug);
}

export async function createShopOrder(input: ShopOrderInput) {
  if (isShopOpsApiEnabled()) {
    const response = await fetch("http://127.0.0.1:3000/api/shop/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    }).catch(() => null);

    if (response?.ok) {
      return response.json();
    }
  }

  throw new Error("Unable to create website order.");
}

// TODO: Replace placeholder quote creation with ops-integrated lead capture.
export async function createQuoteRequest(input: QuoteRequestInput) {
  const draft = buildQuoteRequestDraft({
    customerName: input.name,
    phone: input.phone,
    location: input.location || "",
    propertyType: input.propertyType || "",
    loadDescription: input.load || "",
    budgetRange: input.budgetRange || "",
    preferredProducts: input.preferredProducts || "",
    notes: input.notes,
  });

  if (isShopOpsApiEnabled()) {
    const response = await fetch("http://127.0.0.1:3000/api/shop/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    }).catch(() => null);

    if (response?.ok) {
      return response.json();
    }
  }

  return {
    ok: true,
    source: "mock" as const,
    message: "Quote request placeholder accepted.",
    draft,
    request: input,
  };
}
