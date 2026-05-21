import { allShopProducts, type ShopProduct } from "@/app/shop/shopData";
import {
  buildEcommerceOrderDraft,
  buildMockOrderReference,
  buildMockQuoteReference,
  buildQuoteRequestDraft,
  isShopOpsApiEnabled,
} from "@/app/shop/integrationPlan";

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

// TODO: Replace mock data with ops catalogue API.
export async function getShopProducts(): Promise<ShopProduct[]> {
  if (isShopOpsApiEnabled()) {
    const response = await fetchJson<{ products: ShopProduct[] }>("http://127.0.0.1:3000/api/shop/products").catch(() => null);
    if (response?.products?.length) return response.products;
  }
  return allShopProducts;
}

// TODO: Replace mock product lookup with ops catalogue API by slug.
export async function getShopProductBySlug(slug: string): Promise<ShopProduct | null> {
  if (isShopOpsApiEnabled()) {
    const response = await fetchJson<{ product: ShopProduct | null }>(`http://127.0.0.1:3000/api/shop/products/${slug}`).catch(() => null);
    if (response) return response.product;
  }
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
  const orderRef = buildMockOrderReference();

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
    orderRef,
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
    reference: buildMockQuoteReference(),
    message: "Quote request placeholder accepted.",
    draft,
    request: input,
  };
}
