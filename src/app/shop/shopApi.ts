import { allShopProducts, type ShopProduct } from "@/app/shop/shopData";

type ShopOrderInput = {
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

type QuoteRequestInput = {
  name: string;
  phone: string;
  location?: string;
  propertyType?: string;
  load?: string;
  budgetRange?: string;
  preferredProducts?: string;
  notes?: string;
};

// TODO: Replace mock data with ops catalogue API.
export async function getShopProducts(): Promise<ShopProduct[]> {
  return allShopProducts;
}

// TODO: Replace mock product lookup with ops catalogue API by slug.
export async function getShopProductBySlug(slug: string): Promise<ShopProduct | null> {
  return allShopProducts.find((product) => product.slug === slug) ?? null;
}

// TODO: Checkout should create pending ecommerce order in ops.
// TODO: Link customer to existing customer database.
// TODO: Link completed order to receipt system.
export async function createShopOrder(input: ShopOrderInput) {
  const lineCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const orderRef = `BSO-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return {
    ok: true,
    source: "mock" as const,
    status: "pending_mock" as const,
    orderRef,
    itemCount: lineCount,
    payload: input,
  };
}

// TODO: Replace placeholder quote creation with ops-integrated lead capture.
export async function createQuoteRequest(input: QuoteRequestInput) {
  return {
    ok: true,
    source: "mock" as const,
    reference: `QUOTE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    message: "Quote request placeholder accepted.",
    request: input,
  };
}
