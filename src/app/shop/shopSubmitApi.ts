"use client";

import { buildEcommerceOrderDraft, buildQuoteRequestDraft } from "@/app/shop/integrationPlan";

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

export async function createShopOrder(input: ShopOrderInput) {
  try {
    return await postJson("/api/shop/orders", input);
  } catch {
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

    return {
      ok: true,
      source: "mock" as const,
      status: "pending_mock" as const,
      itemCount: lineCount,
      draft,
      payload: input,
    };
  }
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
