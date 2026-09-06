import { normalizeAvailabilityType } from "@/app/shop/shopAvailability";

export type CheckoutZone = "ZONE_1" | "ZONE_2" | "ZONE_3";
export type CheckoutDeliveryMethod = "LOCAL_DELIVERY" | "COUNTRYWIDE_COURIER" | "SHOP_PICKUP";
export type CheckoutPaymentOption =
  | "PAY_ON_DELIVERY"
  | "PAY_ON_PICKUP"
  | "PAY_10_PERCENT_COMMITMENT"
  | "PAY_30_PERCENT_DEPOSIT"
  | "PAY_TRANSPORT_FEE_FIRST"
  | "PAY_IN_FULL";
export type CheckoutFulfilmentSource = "SHOP_STOCK" | "WAREHOUSE_STOCK" | "ORDER_ON_REQUEST" | "OUT_OF_STOCK";

export type CheckoutFulfilmentLine = {
  quantity: number;
  unitPrice: number;
  availabilityType?: string | null;
  warehouseFulfillmentSource?: string | null;
};

export type CheckoutFulfilmentSummary = {
  shopStockSubtotal: number;
  warehouseStockSubtotal: number;
  orderOnRequestSubtotal: number;
  unavailableSubtotal: number;
  commitmentEligibleSubtotal: number;
  source: "SHOP" | "WAREHOUSE" | "MIXED" | "UNAVAILABLE";
  lineSources: CheckoutFulfilmentSource[];
};

export type CheckoutPaymentPlan = {
  option: CheckoutPaymentOption;
  label: string;
  description: string;
  paymentPercentage: number | null;
  amountDueNow: number;
  remainingProductBalance: number;
  remainingDeliveryBalance: number;
  totalOutstanding: number;
};

const DELIVERY_LABELS: Record<CheckoutDeliveryMethod, string> = {
  LOCAL_DELIVERY: "Local Delivery",
  COUNTRYWIDE_COURIER: "Countrywide Courier / Transport",
  SHOP_PICKUP: "Shop Pickup",
};

export function getCheckoutDeliveryMethodLabel(method: CheckoutDeliveryMethod) {
  return DELIVERY_LABELS[method];
}

export function normalizeCheckoutDeliveryMethod(value: string | null | undefined): CheckoutDeliveryMethod | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "local_delivery" || normalized === "local delivery" || normalized === "nairobi rider delivery") return "LOCAL_DELIVERY";
  if (normalized === "countrywide_courier" || normalized === "countrywide courier" || normalized === "countrywide courier / transport") return "COUNTRYWIDE_COURIER";
  if (normalized === "shop_pickup" || normalized === "shop pickup") return "SHOP_PICKUP";
  return null;
}

export function getEligibleDeliveryMethods(zone: CheckoutZone | null | undefined): CheckoutDeliveryMethod[] {
  if (!zone) return [];
  return zone === "ZONE_1"
    ? ["LOCAL_DELIVERY", "SHOP_PICKUP"]
    : ["COUNTRYWIDE_COURIER", "SHOP_PICKUP"];
}

export function getCheckoutFulfilmentSource(line: Pick<CheckoutFulfilmentLine, "availabilityType" | "warehouseFulfillmentSource">): CheckoutFulfilmentSource {
  const availability = normalizeAvailabilityType(line.availabilityType);
  if (availability === "OUT_OF_STOCK") return "OUT_OF_STOCK";
  if (availability === "WAREHOUSE" || String(line.warehouseFulfillmentSource || "").trim()) return "WAREHOUSE_STOCK";
  if (availability === "ORDER_ON_REQUEST") return "ORDER_ON_REQUEST";
  return "SHOP_STOCK";
}

export function summarizeCheckoutFulfilment(lines: CheckoutFulfilmentLine[]): CheckoutFulfilmentSummary {
  let shopStockSubtotal = 0;
  let warehouseStockSubtotal = 0;
  let orderOnRequestSubtotal = 0;
  let unavailableSubtotal = 0;
  const lineSources = lines.map((line) => {
    const source = getCheckoutFulfilmentSource(line);
    const subtotal = Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0);
    if (source === "SHOP_STOCK") shopStockSubtotal += subtotal;
    if (source === "WAREHOUSE_STOCK") warehouseStockSubtotal += subtotal;
    if (source === "ORDER_ON_REQUEST") orderOnRequestSubtotal += subtotal;
    if (source === "OUT_OF_STOCK") unavailableSubtotal += subtotal;
    return source;
  });
  const commitmentEligibleSubtotal = warehouseStockSubtotal + orderOnRequestSubtotal;
  const source = unavailableSubtotal > 0
    ? "UNAVAILABLE"
    : commitmentEligibleSubtotal > 0 && shopStockSubtotal > 0
      ? "MIXED"
      : commitmentEligibleSubtotal > 0
        ? "WAREHOUSE"
        : "SHOP";
  return { shopStockSubtotal, warehouseStockSubtotal, orderOnRequestSubtotal, unavailableSubtotal, commitmentEligibleSubtotal, source, lineSources };
}

export function getEligibleCheckoutPaymentOptions(input: {
  zone: CheckoutZone | null | undefined;
  deliveryMethod: CheckoutDeliveryMethod | null | undefined;
  fulfilment: CheckoutFulfilmentSummary;
  deliveryFee: number;
  supportsCourierPayOnDelivery?: boolean;
}): CheckoutPaymentOption[] {
  const { zone, deliveryMethod, fulfilment, deliveryFee, supportsCourierPayOnDelivery = false } = input;
  if (!zone || !deliveryMethod || fulfilment.unavailableSubtotal > 0) return [];
  if (fulfilment.commitmentEligibleSubtotal > 0) return ["PAY_10_PERCENT_COMMITMENT", "PAY_IN_FULL"];
  if (deliveryMethod === "SHOP_PICKUP") return ["PAY_ON_PICKUP", "PAY_IN_FULL"];
  if (zone === "ZONE_1" && deliveryMethod === "LOCAL_DELIVERY") return ["PAY_ON_DELIVERY", "PAY_IN_FULL"];
  if (deliveryMethod === "COUNTRYWIDE_COURIER") {
    return [
      "PAY_30_PERCENT_DEPOSIT",
      ...(supportsCourierPayOnDelivery && deliveryFee > 0 ? ["PAY_TRANSPORT_FEE_FIRST" as const] : []),
      "PAY_IN_FULL",
    ];
  }
  return [];
}

export function calculateCheckoutPaymentPlan(input: {
  option: CheckoutPaymentOption;
  productSubtotal: number;
  deliveryFee: number;
  fulfilment: CheckoutFulfilmentSummary;
}): CheckoutPaymentPlan {
  const productSubtotal = Math.max(0, Number(input.productSubtotal) || 0);
  const deliveryFee = Math.max(0, Number(input.deliveryFee) || 0);
  const commitmentFee = Math.round(input.fulfilment.commitmentEligibleSubtotal * 0.1);
  let amountDueNow = 0;
  let paymentPercentage: number | null = null;
  let label = "";
  let description = "";

  if (input.option === "PAY_ON_DELIVERY") {
    label = "Pay on Delivery";
    description = "No advance product payment is required. Pay the order total when the local delivery arrives.";
  } else if (input.option === "PAY_ON_PICKUP") {
    label = "Pay on Pickup";
    description = "No advance product payment is required. Pay when you collect from the Betech shop.";
  } else if (input.option === "PAY_10_PERCENT_COMMITMENT") {
    label = "Pay 10% Commitment Fee";
    description = "Warehouse and order-on-request items require a 10% commitment payment before we reserve or transfer them.";
    paymentPercentage = 10;
    amountDueNow = commitmentFee;
  } else if (input.option === "PAY_30_PERCENT_DEPOSIT") {
    label = "Pay 30% Deposit";
    description = "Pay 30% of the product value now; the transport charge and remaining product balance are due later under the applicable delivery terms.";
    paymentPercentage = 30;
    amountDueNow = Math.round(productSubtotal * 0.3);
  } else if (input.option === "PAY_TRANSPORT_FEE_FIRST") {
    label = "Pay Transport Fee First";
    description = "Pay the transport fee now and pay for the products on delivery, where this courier service supports it.";
    amountDueNow = deliveryFee;
  } else {
    label = "Pay in Full";
    description = "Pay the product total and applicable delivery charge now.";
    paymentPercentage = 100;
    amountDueNow = productSubtotal + deliveryFee;
  }

  const paidTowardsProducts = input.option === "PAY_TRANSPORT_FEE_FIRST" ? 0 : Math.min(productSubtotal, amountDueNow);
  const paidTowardsDelivery = input.option === "PAY_IN_FULL"
    ? deliveryFee
    : input.option === "PAY_TRANSPORT_FEE_FIRST"
      ? deliveryFee
      : 0;
  const remainingProductBalance = Math.max(0, productSubtotal - paidTowardsProducts);
  const remainingDeliveryBalance = Math.max(0, deliveryFee - paidTowardsDelivery);
  return {
    option: input.option,
    label,
    description,
    paymentPercentage,
    amountDueNow,
    remainingProductBalance,
    remainingDeliveryBalance,
    totalOutstanding: remainingProductBalance + remainingDeliveryBalance,
  };
}
