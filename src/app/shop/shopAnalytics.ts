"use client";

type AnalyticsPayload = Record<string, unknown> | undefined;

function logEvent(eventName: string, payload?: AnalyticsPayload) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[shop-analytics] ${eventName}`, payload || {});
}

// TODO: Replace console placeholders with GA4 event dispatch.
// TODO: Add Meta Pixel event mapping for ecommerce and quote flows.
// TODO: Add TikTok Pixel hooks for product, cart, and lead actions.
export function trackShopView(payload?: AnalyticsPayload) {
  logEvent("shop_view", payload);
}

export function trackProductView(payload?: AnalyticsPayload) {
  logEvent("product_view", payload);
}

export function trackAddToCart(payload?: AnalyticsPayload) {
  logEvent("add_to_cart", payload);
}

export function trackCheckoutStarted(payload?: AnalyticsPayload) {
  logEvent("checkout_started", payload);
}

export function trackOrderSubmitted(payload?: AnalyticsPayload) {
  logEvent("order_submitted", payload);
}

export function trackQuoteSubmitted(payload?: AnalyticsPayload) {
  logEvent("quote_submitted", payload);
}

export function trackWhatsAppClick(payload?: AnalyticsPayload) {
  logEvent("whatsapp_click", payload);
}
