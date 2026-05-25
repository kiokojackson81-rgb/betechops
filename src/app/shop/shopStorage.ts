"use client";

import { clearShopCart } from "@/app/shop/cartStore";

const SHOP_ORDER_KEY = "betech-shop-last-order";
const SHOP_QUOTE_KEY = "betech-shop-last-quote";
const SHOP_ORDER_HISTORY_KEY = "betech-shop-order-history";
const SHOP_QUOTE_HISTORY_KEY = "betech-shop-quote-history";
const SHOP_PROFILE_KEY = "betech-shop-customer-profile";
const SHOP_ORDER_COUNTER_KEY = "betech-shop-order-counter";
const SHOP_QUOTE_COUNTER_KEY = "betech-shop-quote-counter";

export type ShopCustomerProfile = {
  fullName: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  countyTown?: string;
  estateLandmark?: string;
  locationNotes?: string;
  updatedAt: string;
};

export type ShopOrderRecord = {
  orderRef: string;
  customerName: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  location: string;
  countyTown?: string;
  estateLandmark?: string;
  locationNotes?: string;
  deliveryMethod: string;
  paymentPreference: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  notes?: string;
  source: "mock" | "website";
  status: "pending" | "PENDING";
  createdAt: string;
};

export type MockOrderRecord = ShopOrderRecord;

export type MockQuoteRecord = {
  quoteRef: string;
  customerName: string;
  phone: string;
  location: string;
  propertyType: string;
  loadDescription: string;
  budgetRange: string;
  preferredProducts: string;
  notes?: string;
  source: "mock";
  status: "new";
  createdAt: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function appendHistory<T extends { createdAt: string }>(key: string, value: T) {
  const current = readJson<T[]>(key);
  const next = [value, ...(Array.isArray(current) ? current : [])].slice(0, 20);
  writeJson(key, next);
}

function readJson<T>(key: string): T | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function buildSequentialReference(prefix: "BT-SHOP" | "BT-QUOTE", counterKey: string) {
  if (!isBrowser()) {
    return `${prefix}-${new Date().getFullYear()}-0001`;
  }

  const year = new Date().getFullYear();
  const current = readJson<{ year: number; count: number }>(counterKey);
  const nextCount = current?.year === year ? current.count + 1 : 1;
  writeJson(counterKey, { year, count: nextCount });

  return `${prefix}-${year}-${String(nextCount).padStart(4, "0")}`;
}

export function saveMockOrder(
  input: Omit<ShopOrderRecord, "orderRef" | "source" | "status" | "createdAt"> & {
    orderRef?: string;
    source?: ShopOrderRecord["source"];
    status?: ShopOrderRecord["status"];
  },
) {
  const order: ShopOrderRecord = {
    orderRef: input.orderRef || buildSequentialReference("BT-SHOP", SHOP_ORDER_COUNTER_KEY),
    source: input.source || "mock",
    status: input.status || "pending",
    createdAt: new Date().toISOString(),
    ...input,
  };

  writeJson(SHOP_ORDER_KEY, order);
  appendHistory(SHOP_ORDER_HISTORY_KEY, order);
  return order;
}

export function getLastMockOrder() {
  return readJson<ShopOrderRecord>(SHOP_ORDER_KEY);
}

export function getMockOrderHistory() {
  return readJson<ShopOrderRecord[]>(SHOP_ORDER_HISTORY_KEY) ?? [];
}

export function saveMockQuote(input: Omit<MockQuoteRecord, "quoteRef" | "source" | "status" | "createdAt">) {
  const quote: MockQuoteRecord = {
    quoteRef: buildSequentialReference("BT-QUOTE", SHOP_QUOTE_COUNTER_KEY),
    source: "mock",
    status: "new",
    createdAt: new Date().toISOString(),
    ...input,
  };

  writeJson(SHOP_QUOTE_KEY, quote);
  appendHistory(SHOP_QUOTE_HISTORY_KEY, quote);
  return quote;
}

export function getLastMockQuote() {
  return readJson<MockQuoteRecord>(SHOP_QUOTE_KEY);
}

export function getMockQuoteHistory() {
  return readJson<MockQuoteRecord[]>(SHOP_QUOTE_HISTORY_KEY) ?? [];
}

export function saveShopCustomerProfile(input: Omit<ShopCustomerProfile, "updatedAt">) {
  const profile: ShopCustomerProfile = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  writeJson(SHOP_PROFILE_KEY, profile);
  return profile;
}

export function getShopCustomerProfile() {
  return readJson<ShopCustomerProfile>(SHOP_PROFILE_KEY);
}

export function clearCartAfterOrder() {
  clearShopCart();
}

export function buildStoredOrderItems(
  items: Array<{
    productId: string;
    quantity: number;
  }>,
  productLookup: Map<string, { name: string; price: number }>,
) {
  return items.flatMap((item) => {
    const product = productLookup.get(item.productId);
    if (!product) return [];

    return [
      {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal: product.price * item.quantity,
      },
    ];
  });
}
