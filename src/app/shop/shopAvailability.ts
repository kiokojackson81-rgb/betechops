export type ShopAvailabilityType = "SHOP" | "WAREHOUSE";

export function normalizeAvailabilityType(value: string | null | undefined): ShopAvailabilityType {
  return String(value || "").trim().toUpperCase() === "WAREHOUSE" ? "WAREHOUSE" : "SHOP";
}

export function getProductAvailabilityMessage(product: {
  availabilityType?: string | null;
  pickupDelayDays?: number | null;
}) {
  const availabilityType = normalizeAvailabilityType(product.availabilityType);

  if (availabilityType === "SHOP") {
    return "✅ Available at shop for immediate pickup.";
  }

  if (availabilityType === "WAREHOUSE") {
    return "🚚 Available from warehouse. Pickup or delivery available after 1 day.";
  }

  return "Availability will be confirmed before delivery or pickup.";
}

export function getProductCheckoutAvailabilityMessage(product: {
  availabilityType?: string | null;
  pickupDelayDays?: number | null;
}) {
  const availabilityType = normalizeAvailabilityType(product.availabilityType);

  if (availabilityType === "SHOP") {
    return "This item is available for same-day shop pickup.";
  }

  if (availabilityType === "WAREHOUSE") {
    return "This item is available from warehouse. Pickup or delivery will be available after 1 day.";
  }

  return "Availability will be confirmed before delivery or pickup.";
}

export function getProductAvailabilityBadge(product: {
  availabilityType?: string | null;
}) {
  const availabilityType = normalizeAvailabilityType(product.availabilityType);

  if (availabilityType === "SHOP") {
    return "✅ Available at Shop";
  }

  if (availabilityType === "WAREHOUSE") {
    return "🚚 Warehouse Stock — Available after 1 day";
  }

  return "Availability to Confirm";
}
