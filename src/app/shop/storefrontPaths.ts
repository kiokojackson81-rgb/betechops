export const SHOP_HOME_HREF = "/";
export const SHOP_ALL_PRODUCTS_HREF = "/all-products";
export const SHOP_ACCOUNT_HREF = "/login/phone?callbackUrl=/account";
export const SHOP_ACCOUNT_ORDERS_HREF = "/account/orders";
export const SHOP_CART_HREF = "/cart";
export const SHOP_CHECKOUT_HREF = "/checkout";
export const SHOP_CHECKOUT_LOGIN_HREF = "/login/phone?callbackUrl=/checkout";
export const SHOP_REQUEST_QUOTE_HREF = "/request-quote";
export const SHOP_LIPA_POLE_POLE_HREF = "/lipa-pole-pole";
export const SHOP_ORDER_SUCCESS_HREF = "/order-success";
export const SHOP_QUOTE_SUCCESS_HREF = "/quote-success";

export function getShopCategoryHref(slug: string) {
  return `/category/${slug}`;
}

export function getShopProductHref(slug: string, opsProductId?: string | null) {
  const href = `/${slug}`;
  const normalizedOpsProductId = String(opsProductId || "").trim();
  if (!normalizedOpsProductId) return href;
  return `${href}?opsProductId=${encodeURIComponent(normalizedOpsProductId)}`;
}

export function getShopLipaPolePoleProductHref(slug: string, opsProductId?: string | null) {
  const href = getShopProductHref(slug, opsProductId);
  return `${href}${href.includes("?") ? "&" : "?"}lpp=1`;
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
