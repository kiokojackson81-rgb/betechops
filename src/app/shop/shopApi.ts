import { allShopProducts, type ShopProduct } from "@/app/shop/shopData";

type ShopOrderInput = {
  productId: string;
  quantity: number;
  customerName?: string;
  customerPhone?: string;
};

type QuoteRequestInput = {
  name: string;
  phone: string;
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
export async function createShopOrder(_input: ShopOrderInput) {
  void _input;
  throw new Error("createShopOrder is not implemented yet.");
}

// TODO: Replace placeholder quote creation with ops-integrated lead capture.
export async function createQuoteRequest(input: QuoteRequestInput) {
  return {
    ok: true,
    source: "mock" as const,
    message: "Quote request placeholder accepted.",
    request: input,
  };
}
