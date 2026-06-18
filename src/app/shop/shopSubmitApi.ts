"use client";

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
  email?: string;
  location?: string;
  county?: string;
  town?: string;
  specificLocation?: string;
  propertyType?: string;
  load?: string;
  budgetRange?: string;
  preferredProducts?: string;
  notes?: string;
};

export type ShopOrderResponse = {
  ok: true;
  source: "website";
  orderRef: string;
  status: "PENDING";
  successUrl: string;
  order: unknown;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shop API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function createShopOrder(input: ShopOrderInput): Promise<ShopOrderResponse> {
  return postJson("/api/shop/orders", input);
}

export async function createQuoteRequest(input: QuoteRequestInput) {
  return postJson<{
    ok: true;
    quoteRef: string;
    quote: {
      id: string;
      quoteRef: string;
    };
  }>("/api/shop/quotes", input);
}
