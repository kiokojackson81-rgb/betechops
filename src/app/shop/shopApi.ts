import { allShopProducts, type ShopProduct } from "@/app/shop/shopData";
import {
  buildEcommerceOrderDraft,
  buildQuoteRequestDraft,
  isShopOpsApiEnabled,
} from "@/app/shop/integrationPlan";
import { filterShopProducts, getOpsCatalogueProductsReadOnlyMapped } from "@/app/shop/shopProductMapper";

export type ShopOrderInput = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customerName: string;
  customerPhone: string;
  location: string;
  deliveryMethod: string;
  paymentPreference: string;
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
    const products = filterShopProducts(await getOpsCatalogueProductsReadOnlyMapped(), input);
    return products.length ? products : filterShopProducts(allShopProducts, input);
  } catch (error) {
    console.error("[shop] server-side product lookup fell back to mock data", error);
    return filterShopProducts(allShopProducts, input);
  }
}

// TODO: Replace preview fallback with verified live ops catalogue reads after testing is complete.
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

  if (response?.products?.length) return response.products;

  return filterShopProducts(allShopProducts, input);
}

export async function getShopProductBySlug(slug: string): Promise<ShopProduct | null> {
  if (typeof window === "undefined") {
    return (await getServerShopProducts()).find((product) => product.slug === slug) ?? null;
  }

  const response = await fetchJson<{ product: ShopProduct | null }>(getApiUrl(`/api/shop/products/${slug}`)).catch(() => null);
  if (response) return response.product;

  return allShopProducts.find((product) => product.slug === slug) ?? null;
}

// TODO: Checkout should create pending ecommerce order in ops.
// TODO: Link customer to existing customer database.
// TODO: Link completed order to receipt system.
export async function createShopOrder(input: ShopOrderInput) {
  const draft = buildEcommerceOrderDraft({
    customerName: input.customerName,
    phone: input.customerPhone,
    location: input.location,
    deliveryMethod: input.deliveryMethod,
    paymentPreference: input.paymentPreference,
    items: input.items,
    notes: input.notes,
  });

  const lineCount = input.items.reduce((sum, item) => sum + item.quantity, 0);

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

  return {
    ok: true,
    source: "mock" as const,
    status: "pending_mock" as const,
    itemCount: lineCount,
    draft,
    payload: input,
  };
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
