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
  projectType:
    | "SOLAR_HOME_SYSTEM"
    | "SOLAR_WATER_PUMP"
    | "SOLAR_WATER_HEATER"
    | "BOREHOLE_SOLAR_SYSTEM"
    | "COMMERCIAL_SOLAR_SYSTEM"
    | "CCTV_PLUS_SOLAR"
    | "STREET_LIGHTS"
    | "OTHER";
  propertyType?: string;
  preferredContactMethod?: "PHONE_CALL" | "WHATSAPP" | "EMAIL";
  bestTimeToContact?: "ANYTIME" | "MORNING" | "AFTERNOON" | "EVENING";
  urgency?: "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "JUST_RESEARCHING";
  installationStatus?: "NEW_INSTALLATION" | "UPGRADE_EXISTING_SYSTEM" | "REPAIR_OR_REPLACEMENT";
  load?: string;
  budgetRange?: string;
  preferredProducts?: string;
  notes?: string;
  answers?: Record<string, unknown>;
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
