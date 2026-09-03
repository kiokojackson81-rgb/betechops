export const SHOP_HOME_HREF = "/";
export const SHOP_ALL_PRODUCTS_HREF = "/all-products";
export const SHOP_DEPARTMENTS_HREF = "/departments";
export const SHOP_ACCOUNT_HREF = "/login/phone?callbackUrl=/account";
export const SHOP_ACCOUNT_ORDERS_HREF = "/account/orders";
export const SHOP_CART_HREF = "/cart";
export const SHOP_CHECKOUT_HREF = "/checkout";
export const SHOP_CHECKOUT_LOGIN_HREF = "/login/phone?callbackUrl=/checkout";
export const SHOP_REQUEST_QUOTE_HREF = "/request-quote";
export const SHOP_LIPA_POLE_POLE_HREF = "/lipa-pole-pole";
export const SHOP_WARRANTY_SUPPORT_HREF = "/warranty-support";
export const SHOP_DELIVERY_PAYMENT_HREF = "/delivery-installation-payment";
export const SHOP_SITE_VISIT_HREF = "/site-visit";
export const SHOP_SITE_VISIT_BOOKING_HREF =
  "/login/phone?callbackUrl=%2Faccount%2Fsite-visits%3Fnew%3D1";
export const SHOP_ORDER_SUCCESS_HREF = "/order-success";
export const SHOP_QUOTE_SUCCESS_HREF = "/quote-success";

export function getShopCategoryHref(slug: string) {
  if (slug === "other-categories") return SHOP_ALL_PRODUCTS_HREF;
  return `/category/${slug}`;
}

export function getShopSubcategoryHref(
  categorySlug: string,
  subcategorySlug: string,
) {
  return `${getShopCategoryHref(categorySlug)}/${subcategorySlug}`;
}

export function getShopProductHref(slug: string, _opsProductId?: string | null) {
  // Public product URLs stay canonical and shareable. Ops IDs remain internal
  // and are resolved server-side when a freshly published slug is requested.
  return `/${slug}`;
}

export function getShopLipaPolePoleProductHref(
  slug: string,
  opsProductId?: string | null,
) {
  const href = getShopProductHref(slug, opsProductId);
  return `${href}${href.includes("?") ? "&" : "?"}lpp=1`;
}

export function getShopSiteVisitProductHref(
  slug: string,
  opsProductId?: string | null,
) {
  const href = getShopProductHref(slug, opsProductId);
  return `${href}${href.includes("?") ? "&" : "?"}siteVisit=1`;
}

export function getShopRequestQuoteHref(product?: string) {
  if (!product) return SHOP_REQUEST_QUOTE_HREF;
  return `${SHOP_REQUEST_QUOTE_HREF}?product=${encodeURIComponent(product)}`;
}

export function getShopOrderSuccessHref(orderRef?: string) {
  if (!orderRef) return SHOP_ORDER_SUCCESS_HREF;
  return `${SHOP_ORDER_SUCCESS_HREF}?ref=${encodeURIComponent(orderRef)}`;
}

export function getShopQuoteSuccessHref(quoteRef?: string) {
  if (!quoteRef) return SHOP_QUOTE_SUCCESS_HREF;
  return `${SHOP_QUOTE_SUCCESS_HREF}?ref=${encodeURIComponent(quoteRef)}`;
}
