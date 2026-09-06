import {
  calculateCheckoutPaymentPlan,
  getEligibleCheckoutPaymentOptions,
  getEligibleDeliveryMethods,
  summarizeCheckoutFulfilment,
} from "@/lib/checkoutDeliveryPayment";

const shopOnly = summarizeCheckoutFulfilment([{ quantity: 1, unitPrice: 100_000, availabilityType: "SHOP" }]);
const warehouseOnly = summarizeCheckoutFulfilment([{ quantity: 1, unitPrice: 100_000, availabilityType: "WAREHOUSE" }]);
const mixed = summarizeCheckoutFulfilment([
  { quantity: 1, unitPrice: 40_000, availabilityType: "SHOP" },
  { quantity: 1, unitPrice: 60_000, availabilityType: "WAREHOUSE" },
]);

describe("checkout delivery and payment rules", () => {
  it.each([
    ["ZONE_1", ["LOCAL_DELIVERY", "SHOP_PICKUP"]],
    ["ZONE_2", ["COUNTRYWIDE_COURIER", "SHOP_PICKUP"]],
    ["ZONE_3", ["COUNTRYWIDE_COURIER", "SHOP_PICKUP"]],
  ] as const)("only exposes compatible delivery methods for %s", (zone, methods) => {
    expect(getEligibleDeliveryMethods(zone)).toEqual(methods);
  });

  it("allows zone 1 shop stock local delivery to pay on delivery or in full", () => {
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_1", deliveryMethod: "LOCAL_DELIVERY", fulfilment: shopOnly, deliveryFee: 500 }))
      .toEqual(["PAY_ON_DELIVERY", "PAY_IN_FULL"]);
  });

  it("requires a 10 percent commitment for zone 1 warehouse local delivery", () => {
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_1", deliveryMethod: "LOCAL_DELIVERY", fulfilment: warehouseOnly, deliveryFee: 500 }))
      .toEqual(["PAY_10_PERCENT_COMMITMENT", "PAY_IN_FULL"]);
  });

  it("allows pay on pickup and full payment for shop-stock collection", () => {
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_1", deliveryMethod: "SHOP_PICKUP", fulfilment: shopOnly, deliveryFee: 0 }))
      .toEqual(["PAY_ON_PICKUP", "PAY_IN_FULL"]);
  });

  it("requires a commitment for warehouse shop pickup", () => {
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_1", deliveryMethod: "SHOP_PICKUP", fulfilment: warehouseOnly, deliveryFee: 0 }))
      .toEqual(["PAY_10_PERCENT_COMMITMENT", "PAY_IN_FULL"]);
  });

  it.each(["ZONE_2", "ZONE_3"] as const)("offers deposit and full payment for %s courier orders", (zone) => {
    expect(getEligibleCheckoutPaymentOptions({ zone, deliveryMethod: "COUNTRYWIDE_COURIER", fulfilment: shopOnly, deliveryFee: 2_500 }))
      .toEqual(["PAY_30_PERCENT_DEPOSIT", "PAY_IN_FULL"]);
  });

  it.each(["ZONE_2", "ZONE_3"] as const)("always allows shop pickup in %s", (zone) => {
    expect(getEligibleCheckoutPaymentOptions({ zone, deliveryMethod: "SHOP_PICKUP", fulfilment: shopOnly, deliveryFee: 0 }))
      .toEqual(["PAY_ON_PICKUP", "PAY_IN_FULL"]);
  });

  it("only exposes transport-fee-first when courier COD support is configured", () => {
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_2", deliveryMethod: "COUNTRYWIDE_COURIER", fulfilment: shopOnly, deliveryFee: 2_500, supportsCourierPayOnDelivery: true }))
      .toEqual(["PAY_30_PERCENT_DEPOSIT", "PAY_TRANSPORT_FEE_FIRST", "PAY_IN_FULL"]);
  });

  it("calculates commitment only from the warehouse portion of a mixed cart", () => {
    expect(mixed).toMatchObject({ shopStockSubtotal: 40_000, warehouseStockSubtotal: 60_000, commitmentEligibleSubtotal: 60_000, source: "MIXED" });
    expect(calculateCheckoutPaymentPlan({ option: "PAY_10_PERCENT_COMMITMENT", productSubtotal: 100_000, deliveryFee: 500, fulfilment: mixed }))
      .toMatchObject({ amountDueNow: 6_000, remainingProductBalance: 94_000, remainingDeliveryBalance: 500, totalOutstanding: 94_500 });
  });

  it("calculates a 30 percent deposit from products, not transport", () => {
    expect(calculateCheckoutPaymentPlan({ option: "PAY_30_PERCENT_DEPOSIT", productSubtotal: 100_000, deliveryFee: 2_500, fulfilment: shopOnly }))
      .toMatchObject({ amountDueNow: 30_000, remainingProductBalance: 70_000, remainingDeliveryBalance: 2_500, totalOutstanding: 72_500 });
  });

  it("calculates transport-fee-first separately from the product balance", () => {
    expect(calculateCheckoutPaymentPlan({ option: "PAY_TRANSPORT_FEE_FIRST", productSubtotal: 100_000, deliveryFee: 2_500, fulfilment: shopOnly }))
      .toMatchObject({ amountDueNow: 2_500, remainingProductBalance: 100_000, remainingDeliveryBalance: 0, totalOutstanding: 100_000 });
  });

  it("calculates pay in full using products plus delivery", () => {
    expect(calculateCheckoutPaymentPlan({ option: "PAY_IN_FULL", productSubtotal: 100_000, deliveryFee: 2_500, fulfilment: shopOnly }))
      .toMatchObject({ amountDueNow: 102_500, remainingProductBalance: 0, remainingDeliveryBalance: 0, totalOutstanding: 0 });
  });

  it("calculates pay on delivery and pickup with no amount due now", () => {
    expect(calculateCheckoutPaymentPlan({ option: "PAY_ON_DELIVERY", productSubtotal: 20_000, deliveryFee: 500, fulfilment: shopOnly }))
      .toMatchObject({ amountDueNow: 0, totalOutstanding: 20_500 });
    expect(calculateCheckoutPaymentPlan({ option: "PAY_ON_PICKUP", productSubtotal: 20_000, deliveryFee: 0, fulfilment: shopOnly }))
      .toMatchObject({ amountDueNow: 0, totalOutstanding: 20_000 });
  });

  it("does not offer payment options for unavailable items", () => {
    const unavailable = summarizeCheckoutFulfilment([{ quantity: 1, unitPrice: 5_000, availabilityType: "OUT_OF_STOCK" }]);
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_1", deliveryMethod: "LOCAL_DELIVERY", fulfilment: unavailable, deliveryFee: 500 })).toEqual([]);
  });

  it("changes eligible options when the delivery method changes", () => {
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_2", deliveryMethod: "COUNTRYWIDE_COURIER", fulfilment: shopOnly, deliveryFee: 1_000 }))
      .toContain("PAY_30_PERCENT_DEPOSIT");
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_2", deliveryMethod: "SHOP_PICKUP", fulfilment: shopOnly, deliveryFee: 0 }))
      .toEqual(["PAY_ON_PICKUP", "PAY_IN_FULL"]);
  });

  it("changes delivery methods when the customer area changes zone", () => {
    expect(getEligibleDeliveryMethods("ZONE_1")).toContain("LOCAL_DELIVERY");
    expect(getEligibleDeliveryMethods("ZONE_3")).not.toContain("LOCAL_DELIVERY");
    expect(getEligibleDeliveryMethods("ZONE_3")).toContain("COUNTRYWIDE_COURIER");
  });

  it("recalculates the payment set when cart fulfilment changes", () => {
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_1", deliveryMethod: "LOCAL_DELIVERY", fulfilment: shopOnly, deliveryFee: 500 }))
      .toContain("PAY_ON_DELIVERY");
    expect(getEligibleCheckoutPaymentOptions({ zone: "ZONE_1", deliveryMethod: "LOCAL_DELIVERY", fulfilment: warehouseOnly, deliveryFee: 500 }))
      .toEqual(["PAY_10_PERCENT_COMMITMENT", "PAY_IN_FULL"]);
  });

  it("does not retain a stale deposit after switching to shop pickup", () => {
    const courierOptions = getEligibleCheckoutPaymentOptions({ zone: "ZONE_2", deliveryMethod: "COUNTRYWIDE_COURIER", fulfilment: shopOnly, deliveryFee: 1_000 });
    const pickupOptions = getEligibleCheckoutPaymentOptions({ zone: "ZONE_2", deliveryMethod: "SHOP_PICKUP", fulfilment: shopOnly, deliveryFee: 0 });
    expect(courierOptions).toContain("PAY_30_PERCENT_DEPOSIT");
    expect(pickupOptions).not.toContain("PAY_30_PERCENT_DEPOSIT");
  });
});
