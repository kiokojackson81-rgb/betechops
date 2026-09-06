"use client";

export type ShopApiError = Error & {
  status?: number;
  redirectTo?: string;
};

export type ShopOrderInput = {
  items: Array<{
    productId: string;
    quantity: number;
    bookingType?: "INSTALLATION";
  }>;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerLocation: string;
  deliveryMethod: string;
  deliveryZone?: "ZONE_1" | "ZONE_2" | "ZONE_3";
  paymentMethod: string;
  notes?: string;
  projectBooking?: {
    zone: "ZONE_1" | "ZONE_2" | "ZONE_3";
    paymentStructure: "FULL_UPFRONT" | "DEPOSIT_30";
    preferredInstallationDate?: string;
  };
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

export type InstallationProjectInput = {
  productId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  county: string;
  town: string;
  exactLocation: string;
  zone: "ZONE_1" | "ZONE_2" | "ZONE_3";
  paymentStructure: "FULL_UPFRONT" | "DEPOSIT_30";
  preferredInstallationDate: string;
  termsAccepted: true;
};

export type InstallationProjectResponse = {
  ok: true;
  source: "project";
  projectRef: string;
  receiptId: string;
  successUrl: string;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      String(payload?.error || payload?.message || `Shop API request failed: ${response.status}`),
    ) as ShopApiError;
    error.status = response.status;
    error.redirectTo = typeof payload?.redirectTo === "string" ? payload.redirectTo : undefined;
    throw error;
  }

  return payload as T;
}

export async function createShopOrder(input: ShopOrderInput): Promise<ShopOrderResponse> {
  return postJson("/api/shop/orders", input);
}

export async function createInstallationProject(
  input: InstallationProjectInput,
): Promise<InstallationProjectResponse> {
  return postJson("/api/shop/installation-projects", input);
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
