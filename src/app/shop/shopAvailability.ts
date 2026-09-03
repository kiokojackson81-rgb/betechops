export type ShopAvailabilityType = "SHOP" | "WAREHOUSE" | "ORDER_ON_REQUEST" | "OUT_OF_STOCK";

export function normalizeAvailabilityType(value: string | null | undefined): ShopAvailabilityType {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "WAREHOUSE" || normalized === "ORDER_ON_REQUEST" || normalized === "OUT_OF_STOCK") return normalized;
  return "SHOP";
}

export function getProductAvailabilityMessage(product: {
  availabilityType?: string | null;
  pickupDelayDays?: number | null;
  warehouseFulfillmentSource?: string | null;
  estimatedDeliveryDays?: string | null;
}) {
  if (product.warehouseFulfillmentSource === "OVERSEAS") {
    return `Ships from abroad${product.estimatedDeliveryDays ? ` - estimated delivery: ${product.estimatedDeliveryDays}.` : "."}`;
  }
  const availabilityType = normalizeAvailabilityType(product.availabilityType);

  if (availabilityType === "SHOP") {
    return "✅ Available at shop for immediate pickup.";
  }

  if (availabilityType === "WAREHOUSE") {
    return "🚚 Available from warehouse. Pickup or delivery available after 1 day.";
  }
  if (availabilityType === "ORDER_ON_REQUEST") return "Order on request. Our team will confirm stock and lead time.";
  if (availabilityType === "OUT_OF_STOCK") return "Currently out of stock.";

  return "Availability will be confirmed before delivery or pickup.";
}

export function getProductCheckoutAvailabilityMessage(product: {
  availabilityType?: string | null;
  pickupDelayDays?: number | null;
  warehouseFulfillmentSource?: string | null;
  estimatedDeliveryDays?: string | null;
}) {
  if (product.warehouseFulfillmentSource === "OVERSEAS") {
    return `Ships from abroad${product.estimatedDeliveryDays ? `. Estimated delivery: ${product.estimatedDeliveryDays}.` : ". Delivery timing will be confirmed before payment."}`;
  }
  const availabilityType = normalizeAvailabilityType(product.availabilityType);

  if (availabilityType === "SHOP") {
    return "This item is available for same-day shop pickup and delivery.";
  }

  if (availabilityType === "WAREHOUSE") {
    return "This item is available from warehouse. Pickup or delivery will be available after 1 day.";
  }
  if (availabilityType === "ORDER_ON_REQUEST") return "Order on request. Availability will be confirmed before payment.";
  if (availabilityType === "OUT_OF_STOCK") return "This item is currently out of stock.";

  return "Availability will be confirmed before delivery or pickup.";
}

export function getProductAvailabilityBadge(product: {
  availabilityType?: string | null;
  warehouseFulfillmentSource?: string | null;
  estimatedDeliveryDays?: string | null;
}) {
  if (product.warehouseFulfillmentSource === "OVERSEAS") return "Ships from Abroad";
  const availabilityType = normalizeAvailabilityType(product.availabilityType);

  if (availabilityType === "SHOP") {
    return "✅ Available at Shop";
  }

  if (availabilityType === "WAREHOUSE") {
    return "🚚 Warehouse Stock — Available after 1 day";
  }
  if (availabilityType === "ORDER_ON_REQUEST") return "Order on Request";
  if (availabilityType === "OUT_OF_STOCK") return "Out of Stock";

  return "Availability to Confirm";
}
