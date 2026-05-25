"use client";

import { buildQuoteRequestDraft } from "@/app/shop/integrationPlan";

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
  try {
    return await postJson("/api/shop/quotes", input);
  } catch {
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

    return {
      ok: true,
      source: "mock" as const,
      message: "Quote request placeholder accepted.",
      draft,
      request: input,
    };
  }
}
